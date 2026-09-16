import { t } from "elysia";

export const input = t.Object({
	text: t.String({ maxLength: 2000 }),
});

export const output = t.Object({
	suggestions: t.Array(
		t.Object({
			from: t.Number({ minimum: 0 }),
			to: t.Number({ minimum: 1 }),
			replacement: t.String(),
			type: t.Union([
				t.Literal("baku"),
				t.Literal("rancu"),
				t.Literal("mubazir"),
				t.Literal("ejaan"),
				t.Literal("imbuhan"),
			]),
			reason: t.String(),
		}),
	),
});
