import { config as loadDotenv } from "dotenv";
import { loadConfig } from "./config.js";
import { createClient } from "./metina-client.js";
import { startWorker } from "./worker.js";

loadDotenv();

const cfg = loadConfig();
const client = createClient(cfg);
await startWorker(cfg, client);
