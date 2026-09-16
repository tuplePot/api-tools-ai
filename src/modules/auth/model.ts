import { t } from "elysia";

export const AuthModel = {
	claims: t.Object({
		sub: t.String(),
		tier: t.Union([t.Literal("fast"), t.Literal("smart")]),
		allowedTools: t.Optional(t.Array(t.String())),
	}),
} as const;

export type AuthModel = {
	[k in keyof typeof AuthModel]: (typeof AuthModel)[k]["static"];
};
