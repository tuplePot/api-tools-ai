import { t } from "elysia";

export const input = t.Object({
	text: t.String({ maxLength: 100 }),
});

export const output = t.Object({
	result: t.String(),
});
