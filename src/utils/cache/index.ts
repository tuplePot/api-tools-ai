import { createHash } from "node:crypto";
import Redis from "ioredis";

type MemEntry = { value: string; expiresAt: number };
const mem = new Map<string, MemEntry>();

let redis: Redis | null = null;

(async () => {
	const r = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
		lazyConnect: true,
		connectTimeout: 2000,
		maxRetriesPerRequest: 1,
		enableOfflineQueue: false,
	});
	r.on("error", () => {});
	try {
		await r.connect();
		redis = r;
		console.log("[Cache] Redis connected");
	} catch {
		console.warn("[Cache] Redis unavailable, using in-memory");
	}
})();

export abstract class Cache {
	static async get(key: string): Promise<unknown | null> {
		if (redis) {
			try {
				const val = await redis.get(key);
				return val ? JSON.parse(val) : null;
			} catch {
				/* fall through */
			}
		}
		const entry = mem.get(key);
		if (!entry) return null;
		if (Date.now() > entry.expiresAt) {
			mem.delete(key);
			return null;
		}
		return JSON.parse(entry.value);
	}

	static async set(
		key: string,
		value: unknown,
		ttlSeconds: number,
	): Promise<void> {
		const serialized = JSON.stringify(value);
		if (redis) {
			try {
				await redis.set(key, serialized, "EX", ttlSeconds);
				return;
			} catch {
				/* fall through */
			}
		}
		mem.set(key, {
			value: serialized,
			expiresAt: Date.now() + ttlSeconds * 1000,
		});
	}
}

export function buildCacheKey(
	toolId: string,
	version: string,
	input: unknown,
): string {
	const hash = createHash("sha256")
		.update(JSON.stringify(input))
		.digest("hex")
		.slice(0, 16);
	return `run:${toolId}:${version}:${hash}`;
}
