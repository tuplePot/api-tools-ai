/**
 * Eval harness for writing.fix-sentence.
 * Usage: bun run eval [--model <model-id>] [--tier fast|smart]
 *
 * Runs all cases in fix-sentence.cases.json, scores each result,
 * and prints a summary table.
 *
 * Scoring per case:
 *   - "expected empty, got empty"   → PASS (1.0)
 *   - "expected empty, got results" → SPURIOUS (0.0) — model over-corrects
 *   - For each expected fragment:
 *       +1 if a suggestion covers the fragment with correct type
 *       +0.5 if type is wrong but fragment is found
 *   - Score = matched / total_expected (0.0–1.0)
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { t } from "elysia";
import OpenAI from "openai";

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const modelArg =
	args[args.indexOf("--model") + 1] ?? process.env.LLM_MODEL_SMART ?? "glm-5.2";
const tierArg = (args[args.indexOf("--tier") + 1] ?? "fast") as
	| "fast"
	| "smart";

// ── Provider ──────────────────────────────────────────────────────────────────
const client = new OpenAI({
	apiKey: process.env.DASHSCOPE_API_KEY ?? "",
	baseURL:
		process.env.DASHSCOPE_BASE_URL ??
		"https://dashscope.aliyuncs.com/compatible-mode/v1",
});

// ── Schema ────────────────────────────────────────────────────────────────────
const outputSchema = t.Object({
	suggestions: t.Array(
		t.Object({
			from: t.Number(),
			to: t.Number(),
			replacement: t.String(),
			type: t.String(),
			reason: t.String(),
		}),
	),
});

// ── Load skill prompt ─────────────────────────────────────────────────────────
import matter from "gray-matter";

const skillPath = path.resolve(
	process.cwd(),
	"skills/writing.fix-sentence/SKILL.md",
);
const { content: systemPrompt } = matter(await readFile(skillPath, "utf-8"));

// ── Types ─────────────────────────────────────────────────────────────────────
type Suggestion = {
	from: number;
	to: number;
	replacement: string;
	type: string;
	reason: string;
};
type Expect = { fragment?: string; replacement?: string; type?: string };
type Case = { id: string; text: string; expects: Expect[] };

// ── Load cases ────────────────────────────────────────────────────────────────
const casesPath = path.resolve(process.cwd(), "evals/fix-sentence.cases.json");
const cases: Case[] = JSON.parse(await readFile(casesPath, "utf-8"));

// ── Scoring ───────────────────────────────────────────────────────────────────
type Verdict = "PASS" | "PARTIAL" | "FAIL" | "SPURIOUS" | "ERROR";

function score(
	text: string,
	suggestions: Suggestion[],
	expects: Expect[],
): { verdict: Verdict; score: number; note: string } {
	if (expects.length === 0) {
		if (suggestions.length === 0)
			return { verdict: "PASS", score: 1.0, note: "empty as expected" };
		return {
			verdict: "SPURIOUS",
			score: 0.0,
			note: `got ${suggestions.length} unexpected suggestion(s)`,
		};
	}

	let matched = 0;
	const notes: string[] = [];

	for (const exp of expects) {
		if (!exp.fragment && !exp.type) continue;

		const found = suggestions.find((s) => {
			if (exp.fragment) {
				const extracted = text.slice(s.from, s.to);
				if (extracted !== exp.fragment) return false;
			}
			return true;
		});

		if (!found) {
			notes.push(`missing: "${exp.fragment ?? exp.type}"`);
			continue;
		}

		if (exp.type && found.type.toLowerCase() !== exp.type) {
			matched += 0.5;
			notes.push(
				`type mismatch "${exp.fragment}": got ${found.type}, want ${exp.type}`,
			);
		} else {
			matched += 1;
		}
	}

	const s = matched / expects.length;
	const verdict: Verdict = s >= 1.0 ? "PASS" : s >= 0.5 ? "PARTIAL" : "FAIL";
	return { verdict, score: s, note: notes.join("; ") || "ok" };
}

// ── Run ───────────────────────────────────────────────────────────────────────
type Row = {
	id: string;
	verdict: Verdict;
	score: number;
	latencyMs: number;
	note: string;
};
const rows: Row[] = [];
let totalTokensIn = 0,
	totalTokensOut = 0;

console.log(`\nEval: writing.fix-sentence  model=${modelArg}  tier=${tierArg}`);
console.log(`Cases: ${cases.length}\n`);

for (const c of cases) {
	const start = Date.now();
	let suggestions: Suggestion[] = [];
	let verdict: Verdict = "ERROR";
	let note = "";

	try {
		const result = await client.chat.completions.create({
			model: modelArg,
			messages: [
				{
					role: "system",
					content: `${systemPrompt.trim()}\n\nBalas HANYA dengan satu objek JSON valid sesuai skema berikut, tanpa teks lain:\n${JSON.stringify(outputSchema)}`,
				},
				{ role: "user", content: `Teks:\n${c.text}` },
			],
			response_format: { type: "json_object" },
		});
		const raw = JSON.parse(result.choices[0]?.message?.content ?? "{}") as {
			suggestions: Suggestion[];
		};
		suggestions = raw.suggestions ?? [];
		totalTokensIn += result.usage?.prompt_tokens ?? 0;
		totalTokensOut += result.usage?.completion_tokens ?? 0;

		const res = score(c.text, suggestions, c.expects);
		verdict = res.verdict;
		note = res.note;
	} catch (err) {
		note = String(err).slice(0, 80);
	}

	const latencyMs = Date.now() - start;
	rows.push({ id: c.id, verdict, score: rows.length, latencyMs, note });

	const icon =
		verdict === "PASS"
			? "✓"
			: verdict === "PARTIAL"
				? "~"
				: verdict === "SPURIOUS"
					? "!"
					: "✗";
	console.log(`  ${icon} [${c.id}] ${verdict}  ${latencyMs}ms  ${note}`);
}

// ── Summary table ─────────────────────────────────────────────────────────────
const counts = { PASS: 0, PARTIAL: 0, FAIL: 0, SPURIOUS: 0, ERROR: 0 };
for (const r of rows) counts[r.verdict]++;

const totalMs = rows.reduce((a, r) => a + r.latencyMs, 0);
const avgMs = Math.round(totalMs / rows.length);
const passRate = ((counts.PASS / rows.length) * 100).toFixed(0);
const partialPct = (
	((counts.PASS + counts.PARTIAL) / rows.length) *
	100
).toFixed(0);

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Model          : ${modelArg}
Cases          : ${rows.length}
PASS           : ${counts.PASS}  (${passRate}%)
PASS + PARTIAL : ${counts.PASS + counts.PARTIAL}  (${partialPct}%)
SPURIOUS       : ${counts.SPURIOUS}
FAIL           : ${counts.FAIL}
ERROR          : ${counts.ERROR}
Avg latency    : ${avgMs}ms
Tokens in/out  : ${totalTokensIn} / ${totalTokensOut}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
