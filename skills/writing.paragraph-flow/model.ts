import { t } from "elysia";

export const input = t.Object({
	paragraph: t.String({ maxLength: 2000 }),
	prevParagraph: t.Optional(t.String({ maxLength: 50000 })),
	nextParagraph: t.Optional(t.String({ maxLength: 50000 })),
});

export const output = t.Object({
	suggestions: t.Array(
		t.Object({
			from: t.Number({ minimum: 0 }),
			to: t.Number({ minimum: 1 }),
			replacement: t.String(),
			type: t.Union([
				t.Literal("missing-bridge"),
				t.Literal("repeated-idea"),
				t.Literal("weak-closing"),
				t.Literal("wrong-order"),
			]),
			reason: t.String(),
		}),
	),
});
