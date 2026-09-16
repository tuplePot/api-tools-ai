import { cors } from "@elysia/cors";
import { openapi } from "@elysia/openapi";
import { Elysia } from "elysia";
import { authToken } from "./modules/auth/token";
import { tools } from "./modules/tools";

export function createApp() {
	return new Elysia()
		.use(cors())
		.use(openapi())
		.get("/health", () => ({ status: "ok" }))
		.use(authToken)
		.use(tools)
		.onError(({ error, code, set }) => {
			if (code === "NOT_FOUND" || code === "VALIDATION") return;
			console.error("[App]", code, error);
			set.status = 500;
			return { error: "Internal server error" };
		});
}
