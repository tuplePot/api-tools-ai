import type { input, output } from "./model";

type Input = typeof input.static;
type Output = typeof output.static;
type SuggestionType = Output["suggestions"][number]["type"];

const VALID_TYPES = new Set<string>([
	"baku",
	"rancu",
	"mubazir",
	"ejaan",
	"imbuhan",
]);

// Normalize common model deviations (uppercase, alternate names) to valid types.
const TYPE_MAP: Record<string, SuggestionType> = {
	ejaan: "ejaan",
	Ejaan: "ejaan",
	EJAAN: "ejaan",
	baku: "baku",
	Baku: "baku",
	BAKU: "baku",
	rancu: "rancu",
	Rancu: "rancu",
	RANCU: "rancu",
	mubazir: "mubazir",
	Mubazir: "mubazir",
	MUBAZIR: "mubazir",
	imbuhan: "imbuhan",
	Imbuhan: "imbuhan",
	IMBUHAN: "imbuhan",
	"tata bahasa": "rancu",
	"Tata Bahasa": "rancu",
	tata_bahasa: "rancu",
	"kata baku": "baku",
	"Kata Baku": "baku",
	"tanda baca": "ejaan",
	"Tanda Baca": "ejaan",
};

export function render(data: Input): string {
	return `Teks:\n${data.text}`;
}

export function refine(raw: Output, data: Input): Output {
	const text = data.text;
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
