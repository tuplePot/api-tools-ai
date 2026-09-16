import { t } from "elysia";

export const input = t.Object({
	text: t.String({ maxLength: 3000 }),
});

export const output = t.Object({
	suggestions: t.Array(
		t.Object({
			from: t.Number({ minimum: 0 }),
			to: t.Number({ minimum: 1 }),
			replacement: t.String(),
			type: t.Union([
				t.Literal("meta-comment"),
				t.Literal("chat-closing"),
				t.Literal("reader-address"),
				t.Literal("empty-opener"),
				t.Literal("ai-word"),
				t.Literal("corporate-neutral"),
				t.Literal("empty-filler"),
				t.Literal("robotic-rhythm"),
			]),
			reason: t.String(),
		}),
	),
});
