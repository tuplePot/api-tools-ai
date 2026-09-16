import OpenAI from "openai";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import type { Stream } from "openai/streaming";

const client = new OpenAI({
	apiKey: process.env.DASHSCOPE_API_KEY ?? "",
	baseURL:
		process.env.DASHSCOPE_BASE_URL ??
		"https://dashscope.aliyuncs.com/compatible-mode/v1",
});

const MODELS = {
	fast: process.env.LLM_MODEL_FAST ?? process.env.LLM_MODEL_SMART ?? "glm-5.2",
	smart: process.env.LLM_MODEL_SMART ?? "glm-5.2",
} as const;

export type Tier = keyof typeof MODELS;

export function getModelId(tier: Tier): string {
	return MODELS[tier];
}

export interface Usage {
	tokensIn: number;
	tokensOut: number;
}

function usageFrom(u: OpenAI.CompletionUsage | undefined): Usage {
	return {
		tokensIn: u?.prompt_tokens ?? 0,
		tokensOut: u?.completion_tokens ?? 0,
	};
}

interface TextArgs {
	tier: Tier;
	system: string;
	prompt: string;
	maxTokens?: number;
}

/**
 * DashScope/GLM-specific: disable the model's "thinking" phase.
 * glm-5.2 is a reasoning model — with thinking on it spends the whole
 * output budget on reasoning_content, leaving message.content empty
 * (finish_reason "length"). Our tools are deterministic transforms, so
 * we turn it off for correct, fast, cheaper output.
 */
const DASHSCOPE_EXTRA = { enable_thinking: false };

/** Free-form text completion (replaces AI SDK generateText). */
export async function generateText(
	args: TextArgs,
): Promise<{ text: string; usage: Usage }> {
	const res = await client.chat.completions.create({
		model: getModelId(args.tier),
		messages: [
			{ role: "system", content: args.system },
			{ role: "user", content: args.prompt },
		],
		max_tokens: args.maxTokens,
		...DASHSCOPE_EXTRA,
	} as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);
	return {
		text: res.choices[0]?.message?.content ?? "",
		usage: usageFrom(res.usage),
	};
}

/**
 * Structured JSON completion (replaces AI SDK generateObject).
 * Uses OpenAI-compatible JSON mode; the schema is embedded in the prompt.
 * The caller is responsible for validating the parsed object against its schema.
 */
export async function generateObject(
	args: TextArgs & { schema: unknown },
): Promise<{ object: unknown; usage: Usage }> {
	const system = `${args.system}\n\nBalas HANYA dengan satu objek JSON valid yang sesuai skema berikut. Jangan sertakan teks lain, penjelasan, atau blok markdown.\n\nSkema JSON:\n${JSON.stringify(args.schema)}`;
	const res = await client.chat.completions.create({
		model: getModelId(args.tier),
		messages: [
			{ role: "system", content: system },
			{ role: "user", content: args.prompt },
		],
		response_format: { type: "json_object" },
		max_tokens: args.maxTokens,
		...DASHSCOPE_EXTRA,
	} as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);
	const content = res.choices[0]?.message?.content ?? "";
	return { object: JSON.parse(content), usage: usageFrom(res.usage) };
}

/**
 * Streaming text completion (replaces AI SDK streamText).
 * Returns the raw OpenAI stream; the final chunk carries usage
 * because stream_options.include_usage is enabled.
 */
export function streamText(
	args: TextArgs,
): Promise<Stream<ChatCompletionChunk>> {
	return client.chat.completions.create({
		model: getModelId(args.tier),
		messages: [
			{ role: "system", content: args.system },
			{ role: "user", content: args.prompt },
		],
		max_tokens: args.maxTokens,
		stream: true,
		stream_options: { include_usage: true },
		...DASHSCOPE_EXTRA,
	} as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming);
}

export { client as llm };
