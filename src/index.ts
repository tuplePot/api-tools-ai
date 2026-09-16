import { createApp } from "./app";
import { Registry } from "./modules/tools/registry";
import { Db } from "./utils/db";

Registry.boot();
await Db.connect();

createApp().listen(Number(process.env.PORT ?? 3000), ({ hostname, port }) => {
	console.log(`[Server] http://${hostname}:${port}`);
});
