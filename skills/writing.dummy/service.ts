import type { input } from "./model";

export function render(data: typeof input.static): string {
	return `Echo: ${data.text}`;
}
