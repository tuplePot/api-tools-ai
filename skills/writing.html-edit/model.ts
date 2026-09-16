import { t } from "elysia";

export const input = t.Object({
	text: t.String({ maxLength: 50000 }),
	instruction: t.String({ maxLength: 50000 }),
});

export const output = t.Object({
	html: t.String(),
});
