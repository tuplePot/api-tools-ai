import { createHash } from "node:crypto";

type MemEntry = { value: string; expiresAt: number };
const mem = new Map<string, MemEntry>();

export abstract class Cache {
	static async get(key: string): Promise<unknown | null> {
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
		mem.set(key, {
			value: JSON.stringify(value),
			expiresAt: Date.now() + ttlSeconds * 1000,
		});
	}
}

export function buildCacheKey(
	toolId: string,
	version: string,
	input: unknown,
): string {
	return `run:${toolId}:${version}:${createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 16)}`;
}
