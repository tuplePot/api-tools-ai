import { bearer } from "@elysia/bearer";
import { jwt } from "@elysia/jwt";
import { Elysia } from "elysia";
import { check } from "../../utils/validate";
import { AuthModel } from "./model";

export const AuthService = new Elysia({ name: "Auth.Service" })
	.use(
		jwt({
			name: "jwt",
			secret: process.env.JWT_SECRET ?? "dev-secret-change-in-production",
		}),
	)
	.use(bearer())
	.macro({
		isSignIn: {
			async resolve({ bearer, jwt, status }) {
				if (!bearer) return status(401, "Unauthorized");
				const payload = await jwt.verify(bearer);
				if (!payload) return status(401, "Unauthorized");
				if (!check(AuthModel.claims, payload))
					return status(401, "Invalid token claims");
				return { claims: payload as AuthModel["claims"] };
			},
		},
	});
