import { createApp } from "../src/app";
import { Registry } from "../src/modules/tools/registry";
import { Db } from "../src/utils/db";

Registry.boot();
await Db.connect();

export default createApp();
