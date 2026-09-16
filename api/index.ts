import { createApp } from "../src/app";
import { Registry } from "../src/modules/tools/registry";
import { Db } from "../src/utils/db";

let initialized = false;
let initPromise: Promise<void> | null = null;

function ensureInit(): Promise<void> {
	if (initialized) return Promise.resolve();
	if (!initPromise) {
		initPromise = (async () => {
			Registry.boot();
			await Db.connect();
			initialized = true;
		})();
	}
	return initPromise;
}

const app = createApp();

export default async function handler(req: Request): Promise<Response> {
	await ensureInit();
	return app.handle(req);
}
