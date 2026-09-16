import { jwt } from "@elysia/jwt";
import { Elysia, t } from "elysia";

const API_KEY = process.env.AI_TOOLS_API_KEY;

export const authToken = new Elysia({ prefix: "/v1/auth" })
	.use(
		jwt({
			name: "jwt",
			secret: process.env.JWT_SECRET ?? "dev-secret-change-in-production",
		}),
	)
	.post(
		"/token",
		async ({ headers, jwt, body, status }) => {
			if (!API_KEY)
				return status(
					503,
					"Token issuance not configured: set AI_TOOLS_API_KEY",
				);

			const apiKey = headers["x-api-key"];
			if (!apiKey || apiKey !== API_KEY) return status(401, "Invalid API key");

			const exp = Math.floor(Date.now() / 1000) + 3600;

			const token = await jwt.sign({
				sub: body.sub ?? "cms-user",
				tier: body.tier,
				exp,
				...(body.allowedTools ? { allowedTools: body.allowedTools } : {}),
			});

			return { token, expiresIn: 3600 };
		},
		{
			body: t.Object({
				sub: t.Optional(t.String()),
				tier: t.Union([t.Literal("fast"), t.Literal("smart")]),
				allowedTools: t.Optional(t.Array(t.String())),
			}),
		},
	);
