import type { input, output } from "./model";

type Input = typeof input.static;
type Output = typeof output.static;
type SuggestionType = Output["suggestions"][number]["type"];

const VALID_TYPES = new Set<string>([
	"missing-bridge",
	"repeated-idea",
	"weak-closing",
	"wrong-order",
]);

const TYPE_MAP: Record<string, SuggestionType> = {
	"missing-bridge": "missing-bridge",
	missing_bridge: "missing-bridge",
	"repeated-idea": "repeated-idea",
	repeated_idea: "repeated-idea",
	"weak-closing": "weak-closing",
	weak_closing: "weak-closing",
	"wrong-order": "wrong-order",
	wrong_order: "wrong-order",
};

export function render(data: Input): string {
	const parts: string[] = [];
	if (data.prevParagraph)
		parts.push(`[Paragraf sebelumnya]\n${data.prevParagraph}`);
	parts.push(`[Paragraf yang diperiksa]\n${data.paragraph}`);
	if (data.nextParagraph)
		parts.push(`[Paragraf sesudahnya]\n${data.nextParagraph}`);
	return parts.join("\n\n");
}

export function refine(raw: Output, data: Input): Output {
	const text = data.paragraph;
	const sorted = [...raw.suggestions].sort((a, b) => a.from - b.from);
	const valid: Output["suggestions"] = [];
	let lastTo = -1;

	for (const s of sorted) {
		if (s.to <= s.from) continue;
		if (s.to > text.length) continue;
		if (text.slice(s.from, s.to) === s.replacement) continue;
		if (s.from < lastTo) continue;

		const normalizedType =
			TYPE_MAP[s.type] ??
			(VALID_TYPES.has(s.type) ? (s.type as SuggestionType) : null);
		if (!normalizedType) continue;

		valid.push({ ...s, type: normalizedType });
		lastTo = s.to;
	}

	return { suggestions: valid };
}
