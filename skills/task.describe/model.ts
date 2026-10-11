import { t } from "elysia";

export const input = t.Object({
	title: t.String({ minLength: 1, maxLength: 1000 }),
	issueType: t.Optional(
		t.Union([
			t.Literal("feature"),
			t.Literal("bug"),
			t.Literal("task"),
			t.Literal("chore"),
		]),
	),
	project: t.Optional(t.String({ maxLength: 120 })),
	notes: t.Optional(t.String({ maxLength: 5000 })),
});

export const output = t.Object({
	description: t.String(),
});
