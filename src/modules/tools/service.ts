import { randomUUID } from "node:crypto";
import { status } from "elysia";
import { check, formatErrors } from "../../utils/validate";
import { buildCacheKey, Cache } from "../../utils/cache";
import { RunModel } from "../../utils/db";
import {
	generateObject,
	generateText,
	getModelId,
	streamText,
} from "../../utils/llm";
import type { ToolsModel } from "./model";
import { Registry } from "./registry";

function splitIntoChunks(text: string, chunkSize: number): string[] {
	if (text.length <= chunkSize) return [text];
	const parts = text.split("\n\n");
	const chunks: string[] = [];
	let cur = "";
	for (const p of parts) {
		const candidate = cur ? `${cur}\n\n${p}` : p;
		if (cur && candidate.length > chunkSize) {
			chunks.push(cur);
			cur = p;
		} else {
			cur = candidate;
		}
	}
	if (cur) chunks.push(cur);
	return chunks;
}

function estimateMaxTokens(promptLength: number): number {
	// Output for text-mode tools is roughly same length as input
	return Math.min(8192, Math.max(1024, Math.ceil(promptLength / 2)));
}

export abstract class Tools {
	static async run({
		toolId,
		input,
		userId,
	}: ToolsModel["runArgs"]): Promise<ToolsModel["runResponse"]> {
		const skill = Registry.get(toolId);
		if (!skill)
			throw status(404, "Tool not found" satisfies ToolsModel["notFound"]);

		if (!check(skill.input, input)) {
			const errs = formatErrors(skill.input, input);
			throw status(422, errs);
		}

		const { frontmatter, systemPrompt } = skill;
		const cacheKey = buildCacheKey(toolId, frontmatter.version, input);
		const startMs = Date.now();

		const runId = randomUUID();
		const modelId = getModelId(frontmatter.tier);

		const hit = await Cache.get(cacheKey);
		if (hit !== null) {
			const latencyMs = Date.now() - startMs;
			RunModel.create({
				runId,
				toolId,
				userId,
				promptVersion: frontmatter.version,
				tier: frontmatter.tier,
				model: modelId,
				latencyMs,
				cached: true,
				status: "ok",
			}).catch(() => {});
			return { runId, toolId, output: hit, cached: true, latencyMs };
		}

		const inputObj = input as Record<string, unknown>;
		const outputKey = Object.keys(
			(skill.output as any).properties,
		)[0] as string;

		let object: unknown;
		let tokensIn = 0,
			tokensOut = 0;
		try {
			if (frontmatter.outputMode === "text") {
				const textField = inputObj.text as string | undefined;
				const chunkSize = frontmatter.chunkSize;

				if (chunkSize && textField && textField.length > chunkSize) {
					// Parallel chunked processing
					const chunks = splitIntoChunks(textField, chunkSize);
					const results = await Promise.all(
						chunks.map(async (chunk) => {
							const msg = skill.render({ ...inputObj, text: chunk });
							const r = await generateText({
								tier: frontmatter.tier,
								system: systemPrompt,
								prompt: msg,
								maxTokens: estimateMaxTokens(msg.length),
							});
							tokensIn += r.usage.tokensIn;
							tokensOut += r.usage.tokensOut;
							return r.text;
						}),
					);
					object = { [outputKey]: results.join("\n\n") };
				} else {
					const userMessage = skill.render(input);
					const result = await generateText({
						tier: frontmatter.tier,
						system: systemPrompt,
						prompt: userMessage,
						maxTokens: estimateMaxTokens(userMessage.length),
					});
					object = { [outputKey]: result.text };
					tokensIn = result.usage.tokensIn;
					tokensOut = result.usage.tokensOut;
				}
			} else {
				const userMessage = skill.render(input);
				const result = await generateObject({
					tier: frontmatter.tier,
					schema: skill.output,
					system: systemPrompt,
					prompt: userMessage,
				});
				if (!check(skill.output, result.object)) {
					throw new Error("Model output does not match schema");
				}
				object = result.object;
				tokensIn = result.usage.tokensIn;
				tokensOut = result.usage.tokensOut;
			}
		} catch (err) {
			const latencyMs = Date.now() - startMs;
			RunModel.create({
				runId,
				toolId,
				userId,
				promptVersion: frontmatter.version,
				tier: frontmatter.tier,
				model: modelId,
				latencyMs,
				cached: false,
				status: "error",
				error: String(err),
			}).catch(() => {});
			throw status(502, "Model output invalid — check prompt");
		}

		const output = skill.refine ? skill.refine(object, input) : object;
		const latencyMs = Date.now() - startMs;

		if (frontmatter.cacheTtl > 0) {
			Cache.set(cacheKey, output, frontmatter.cacheTtl).catch(() => {});
		}

		RunModel.create({
			runId,
			toolId,
			userId,
			promptVersion: frontmatter.version,
			tier: frontmatter.tier,
			model: modelId,
			tokensIn,
			tokensOut,
			latencyMs,
			cached: false,
			status: "ok",
		}).catch(() => {});

		return { runId, toolId, output, cached: false, latencyMs };
	}

	static stream({ toolId, input, userId }: ToolsModel["runArgs"]): Response {
		const skill = Registry.get(toolId);
		if (!skill)
			throw status(404, "Tool not found" satisfies ToolsModel["notFound"]);

		if (skill.frontmatter.outputMode !== "text") {
			throw status(400, "Streaming only supported for text-output tools");
		}

		if (!check(skill.input, input)) {
			const errs = formatErrors(skill.input, input);
			throw status(422, errs);
		}

		const { frontmatter, systemPrompt } = skill;
		const inputObj = input as Record<string, unknown>;
		const runId = randomUUID();
		const modelId = getModelId(frontmatter.tier);
		const startMs = Date.now();

		const textField = inputObj.text as string | undefined;
		// Use maxInputChars as chunk boundary for streaming (chunkSize is for parallel /run).
		const chunks =
			frontmatter.maxInputChars &&
			textField &&
			textField.length > frontmatter.maxInputChars
				? splitIntoChunks(textField, frontmatter.maxInputChars)
				: null;

		// ── Simple path (no chunking): stream the single completion ──────────────
		if (!chunks) {
			const userMessage = skill.render(input);
			const encoder = new TextEncoder();
			const body = new ReadableStream({
				async start(controller) {
					let tokensIn = 0,
						tokensOut = 0;
					try {
						const stream = await streamText({
							tier: frontmatter.tier,
							system: systemPrompt,
							prompt: userMessage,
							maxTokens: estimateMaxTokens(userMessage.length),
						});
						for await (const part of stream) {
							const delta = part.choices[0]?.delta?.content;
							if (delta) controller.enqueue(encoder.encode(delta));
							if (part.usage) {
								tokensIn = part.usage.prompt_tokens;
								tokensOut = part.usage.completion_tokens;
							}
						}
					} catch (err) {
						console.error("[Stream] error:", err);
					} finally {
						try {
							controller.close();
						} catch {}
						RunModel.create({
							runId,
							toolId,
							userId,
							promptVersion: frontmatter.version,
							tier: frontmatter.tier,
							model: modelId,
							tokensIn,
							tokensOut,
							latencyMs: Date.now() - startMs,
							cached: false,
							status: "ok",
						}).catch(() => {});
					}
				},
			});
			return new Response(body, {
				headers: { "Content-Type": "text/plain; charset=utf-8" },
			});
		}

		// ── Chunked path (text > maxInputChars): manual ReadableStream ────────────
		const encoder = new TextEncoder();
		const body = new ReadableStream({
			async start(controller) {
				let tokensIn = 0,
					tokensOut = 0;

				function safeEnqueue(data: Uint8Array): boolean {
					try {
						controller.enqueue(data);
						return true;
					} catch (e) {
						console.warn(
							"[Stream] enqueue skipped (cancelled):",
							(e as Error)?.message,
						);
						return false;
					}
				}

				try {
					for (let i = 0; i < chunks.length; i++) {
						if (i > 0 && !safeEnqueue(encoder.encode("\n\n"))) break;
						const msg = skill.render({ ...inputObj, text: chunks[i] });
						const stream = await streamText({
							tier: frontmatter.tier,
							system: systemPrompt,
							prompt: msg,
							maxTokens: estimateMaxTokens(msg.length),
						});
						let cancelled = false;
						for await (const part of stream) {
							const delta = part.choices[0]?.delta?.content;
							if (delta && !safeEnqueue(encoder.encode(delta))) {
								cancelled = true;
								break;
							}
							if (part.usage) {
								tokensIn += part.usage.prompt_tokens;
								tokensOut += part.usage.completion_tokens;
							}
						}
						if (cancelled) break;
					}
				} catch (err) {
					console.error("[Stream] chunked error:", err);
					safeEnqueue(
						encoder.encode(
							`\n\n[STREAM_ERROR: ${err instanceof Error ? err.message : String(err)}]`,
						),
					);
				} finally {
					try {
						controller.close();
					} catch {}
					RunModel.create({
						runId,
						toolId,
						userId,
						promptVersion: frontmatter.version,
						tier: frontmatter.tier,
						model: modelId,
						tokensIn,
						tokensOut,
						latencyMs: Date.now() - startMs,
						cached: false,
						status: "ok",
					}).catch(() => {});
				}
			},
		});
		return new Response(body, {
			headers: { "Content-Type": "text/plain; charset=utf-8" },
		});
	}
}
