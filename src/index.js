import { config as loadDotenv } from "dotenv";
import { loadConfig } from "./config.js";
import { createClient } from "./metina-client.js";
import { createTelegramNotifier } from "./telegram.js";
import { startWorker } from "./worker.js";

loadDotenv();

const cfg = loadConfig();
const client = createClient(cfg);
const notifier = createTelegramNotifier(cfg.telegram);
await startWorker(cfg, client, { notifier });

