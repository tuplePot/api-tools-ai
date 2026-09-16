import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { input, output } from "./model";

type Input = typeof input.static;
type Output = typeof output.static;
type Suggestion = Output["suggestions"][number];
type SuggestionType = Suggestion["type"];

const SKILL_DIR = path.dirname(fileURLToPath(import.meta.url));

const VALID_TYPES = new Set<string>([
	"meta-comment",
	"chat-closing",
	"reader-address",
	"empty-opener",
	"ai-word",
	"corporate-neutral",
	"empty-filler",
	"robotic-rhythm",
]);

const TYPE_MAP: Record<string, SuggestionType> = {
	"meta-comment": "meta-comment",
	meta_comment: "meta-comment",
	"chat-closing": "chat-closing",
	chat_closing: "chat-closing",
	"reader-address": "reader-address",
	reader_address: "reader-address",
	"empty-opener": "empty-opener",
	empty_opener: "empty-opener",
	"ai-word": "ai-word",
	ai_word: "ai-word",
	"corporate-neutral": "corporate-neutral",
	corporate_neutral: "corporate-neutral",
	"empty-filler": "empty-filler",
	empty_filler: "empty-filler",
	"robotic-rhythm": "robotic-rhythm",
	robotic_rhythm: "robotic-rhythm",
};

// ── Layer 1: rule-based ───────────────────────────────────────────────────────

type PatternDef = { pattern: string; note: string };
type PatternsFile = {
	phrases: PatternDef[];
	words: string[];
	patterns: PatternDef[];
};

let _patterns: PatternsFile | null = null;

function loadPatterns(): PatternsFile {
	if (_patterns) return _patterns;
	const raw = readFileSync(path.join(SKILL_DIR, "patterns.json"), "utf-8");
	_patterns = JSON.parse(raw) as PatternsFile;
	return _patterns;
}

function layer1(text: string): Suggestion[] {
	const pf = loadPatterns();
	const results: Suggestion[] = [];

	const allRegexes: Array<{ re: RegExp; type: SuggestionType }> = [
		...pf.phrases.map((p) => ({
			re: new RegExp(p.pattern, "gi"),
			type: "meta-comment" as SuggestionType,
		})),
		...pf.patterns.map((p) => ({
			re: new RegExp(p.pattern, "gim"),
			type: "meta-comment" as SuggestionType,
		})),
	];

	for (const { re, type } of allRegexes) {
		re.lastIndex = 0;
		let m: RegExpExecArray | null = re.exec(text);
		while (m !== null) {
			const from = m.index;
			const rawTo = from + m[0].length;
			// Extend to end of sentence
			const tail = text.slice(rawTo);
			const end = tail.search(/[.!?\n]/);
			const to = Math.min(
				end === -1 ? text.length : rawTo + end + 1,
				text.length,
			);
			results.push({
				from,
				to,
				replacement: "",
				type,
				reason: `Rule: ${m[0].slice(0, 50)}`,
			});
			m = re.exec(text);
		}
	}

	// Individual AI words
	const wordRe = new RegExp(`\\b(${pf.words.join("|")})\\b`, "gi");
	let wm: RegExpExecArray | null = wordRe.exec(text);
	while (wm !== null) {
		results.push({
			from: wm.index,
			to: wm.index + wm[0].length,
			replacement: "",
			type: "ai-word",
			reason: `Kosakata khas AI: "${wm[0]}"`,
		});
		wm = wordRe.exec(text);
	}

	return results;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function render(data: Input): string {
	return `Teks:\n${data.text}`;
}

export function refine(llmOutput: Output, data: Input): Output {
	const text = data.text;
	const layer1Results = layer1(text);

	const all: Suggestion[] = [
		...layer1Results,
		...llmOutput.suggestions
			.map((s) => {
				const normalizedType =
					TYPE_MAP[s.type] ??
					(VALID_TYPES.has(s.type) ? (s.type as SuggestionType) : null);
				return normalizedType ? { ...s, type: normalizedType } : null;
			})
			.filter((s): s is Suggestion => s !== null),
	];

	const sorted = all.sort((a, b) => a.from - b.from);
	const valid: Suggestion[] = [];
	let lastTo = -1;

	for (const s of sorted) {
		if (s.to <= s.from) continue;
		if (s.to > text.length) continue;
		if (text.slice(s.from, s.to) === s.replacement) continue;
		if (s.from < lastTo) continue;

		valid.push(s);
		lastTo = s.to;
	}

	return { suggestions: valid };
}
