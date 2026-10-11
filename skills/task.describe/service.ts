import type { input, output } from "./model";

type Input = typeof input.static;
type Output = typeof output.static;

/** The todolist API caps `Task.description` at 5000 chars. */
const MAX_DESCRIPTION = 5000;

export function render(data: Input): string {
	const parts = [`Judul task: ${data.title}`];
	parts.push(`Tipe: ${data.issueType ?? "task"}`);
	if (data.project) parts.push(`Project: ${data.project}`);
	if (data.notes?.trim())
		parts.push(`Catatan dari pengguna:\n${data.notes.trim()}`);
	return parts.join("\n");
}

export function refine(raw: Output, _data: Input): Output {
	const description = raw.description
		// Models sometimes wrap the answer in a code fence despite the prompt.
		.replace(/^\s*```[a-z]*\n?/i, "")
		.replace(/\n?```\s*$/, "")
		// …or prefix it with a label.
		.replace(/^\s*(deskripsi|description)\s*:\s*/i, "")
		.trim()
		.slice(0, MAX_DESCRIPTION);
	return { description };
}
