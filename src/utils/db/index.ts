import mongoose, { Schema } from "mongoose";

export abstract class Db {
	static async connect(): Promise<void> {
		const uri = process.env.DATABASE_URL ?? process.env.MONGODB_URI;
		if (!uri) {
			console.warn("[Db] no DATABASE_URL set, run logging disabled");
			return;
		}
		await mongoose.connect(uri);
		console.log(
			"[Db] MongoDB connected →",
			mongoose.connection.db?.databaseName,
		);
	}
}

const RunSchema = new Schema({
	runId: { type: String, required: true, index: true },
	toolId: { type: String, required: true },
	userId: { type: String, required: true },
	promptVersion: String,
	tier: String,
	model: String,
	tokensIn: Number,
	tokensOut: Number,
	latencyMs: Number,
	costUsd: Number,
	cached: Boolean,
	status: { type: String, enum: ["ok", "error"], default: "ok" },
	error: String,
	createdAt: { type: Date, default: Date.now },
});

export const RunModel = mongoose.models.Run ?? mongoose.model("Run", RunSchema);
