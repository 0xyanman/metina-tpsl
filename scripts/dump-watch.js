import { config as loadDotenv } from "dotenv";
import { loadConfig } from "../src/config.js";
import { createClient } from "../src/metina-client.js";
import { evaluateExit } from "../src/evaluate-exit.js";

loadDotenv();
const cfg = loadConfig();
const client = createClient(cfg);
await client.login();
const data = await client.positions({ discover: true });
const rows = (data.positions || []).map((p) => {
  const pnl = p.pnl && typeof p.pnl === "object" ? p.pnl : {};
  const hit = evaluateExit(p);
  return {
    pair: p.pair,
    chain: p.chain,
    sl: p.stop_loss_pct,
    tp: p.take_profit_pct,
    top_reliable: p.pnl_reliable,
    pnl_reliable: pnl.pnl_reliable,
    seeded: p.entry_seeded_from_principal ?? pnl.entry_seeded_from_principal ?? false,
    onchain_pct: pnl.onchain_pnl_pct,
    display_pct: pnl.pnl_pct,
    hit: hit.kind || null,
    reason: hit.reason || null,
  };
});
console.log(JSON.stringify(rows, null, 2));
