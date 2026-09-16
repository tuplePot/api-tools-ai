import { Elysia, status, t } from "elysia";
import { AuthService } from "../auth";
import { ToolsModel } from "./model";
import { Registry } from "./registry";
import { Tools } from "./service";

export const tools = new Elysia({ prefix: "/v1/tools" })
	.use(AuthService)
	.get(
		"/",
		() =>
			Registry.getAll().map((s) => ({
				id: s.frontmatter.id,
				name: s.frontmatter.name,
				description: s.frontmatter.description,
				tier: s.frontmatter.tier,
				mode: s.frontmatter.mode,
				version: s.frontmatter.version,
				maxInputChars: s.frontmatter.maxInputChars,
				inputSchema: s.input,
			})),
		{ response: t.Array(ToolsModel.toolSummary) },
	)
	.post(
		"/:id/run",
		({ params, body, claims }) => {
			if (claims.allowedTools && !claims.allowedTools.includes(params.id)) {
				throw status(403, "Tool not allowed");
			}
			return Tools.run({ toolId: params.id, input: body, userId: claims.sub });
		},
		{
			isSignIn: true,
			body: ToolsModel.runBody,
			response: {
				200: ToolsModel.runResponse,
				404: ToolsModel.notFound,
			},
		},
	)
	.post(
		"/:id/stream",
		({ params, body, claims }) => {
			if (claims.allowedTools && !claims.allowedTools.includes(params.id)) {
				throw status(403, "Tool not allowed");
			}
			return Tools.stream({
				toolId: params.id,
				input: body,
				userId: claims.sub,
			});
		},
		{
			isSignIn: true,
			body: ToolsModel.runBody,
		},
	)
	.onError(({ error, code }) => {
		if (code === "UNKNOWN") console.error("[Tools]", error);
	});
