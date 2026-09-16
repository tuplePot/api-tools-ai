export function render({
	text,
	instruction,
}: {
	text: string;
	instruction: string;
}): string {
	return `Instruksi: ${instruction}\n\nTeks:\n${text}`;
}
