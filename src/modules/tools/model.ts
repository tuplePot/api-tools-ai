import { t } from "elysia";

export const ToolsModel = {
	runBody: t.Unknown(),
	runArgs: t.Object({
		toolId: t.String(),
		input: t.Unknown(),
		userId: t.String(),
	}),
	runResponse: t.Object({
		runId: t.String(),
		toolId: t.String(),
		output: t.Unknown(),
		cached: t.Boolean(),
		latencyMs: t.Number(),
	}),
	toolSummary: t.Object({
		id: t.String(),
		name: t.String(),
		description: t.String(),
		tier: t.Union([t.Literal("fast"), t.Literal("smart")]),
		mode: t.Literal("sync"),
		version: t.String(),
		maxInputChars: t.Number(),
		inputSchema: t.Unknown(),
	}),
	notFound: t.Literal("Tool not found"),
} as const;

export type ToolsModel = {
	[k in keyof typeof ToolsModel]: (typeof ToolsModel)[k]["static"];
};
