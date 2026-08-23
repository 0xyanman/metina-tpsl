import { closePayload, evaluateExit, positionKey } from "./evaluate-exit.js";

function now() {
  return new Date().toISOString();
}

function log(msg) {
  console.log(`[${now()}] ${msg}`);
}

export async function runCycle(client, { liveClose, discover }, inflight) {
  const data = await client.positions({ discover });
  const list = Array.isArray(data.positions) ? data.positions : [];
  const open = list.filter((p) => !p.closed_on_chain && !p.readonly);
  let hits = 0;

  for (const p of open) {
    const decision = evaluateExit(p);
    if (decision.action !== "close") continue;
    hits += 1;
    const key = positionKey(p);
    const label = `${p.pair || p.position} ${decision.kind} (${decision.reason})`;
    if (inflight.has(key)) {
      log(`skip in-flight ${label}`);
      continue;
    }
    if (!liveClose) {
      log(`DRY ${label}`);
      continue;
    }
    inflight.add(key);
    log(`closing ${label}`);
    try {
      const result = await client.close(closePayload(p, {
        swap: true,
        kind: decision.kind,
        close_reason: decision.reason,
      }));
      const ok = result.success || result.ok;
      log(
        ok
          ? `closed ${p.pair || p.position} tx=${result.tx || result.txs?.[0] || "ok"}`
          : `close failed ${p.pair || p.position}: ${result.error || result.message || "unknown"}`,
      );
      if (!ok) inflight.delete(key);
    } catch (err) {
      inflight.delete(key);
      log(`close error ${p.pair || p.position}: ${err.message}`);
    }
  }

  return { count: open.length, hits };
}

export async function startWorker(cfg, client) {
  await client.login();
  log(`logged in as ${cfg.email} wallet ${cfg.address}`);
  log(
    cfg.liveClose
      ? "LIVE_CLOSE=1 — will close when SL/TP hits"
      : "LIVE_CLOSE=0 — watch only. Set LIVE_CLOSE=1 in .env to close.",
  );

  const inflight = new Set();
  let tick = 0;
  let busy = false;

  const once = async () => {
    if (busy) {
      log("skip overlap — previous cycle still running");
      return;
    }
    busy = true;
    tick += 1;
    const discover = tick === 1 || tick % cfg.discoverEvery === 0;
    try {
      const { count, hits } = await runCycle(client, { liveClose: cfg.liveClose, discover }, inflight);
      log(`watch ${count} open · hits ${hits}${discover ? " · discover" : ""}`);
    } catch (err) {
      log(`cycle failed: ${err.message}`);
    } finally {
      busy = false;
    }
  };

  await once();
  return setInterval(once, cfg.pollMs);
}
