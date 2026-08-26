import { closePayload, evaluateExit, positionKey, watchLine } from "./evaluate-exit.js";
import { createPositionTracker, formatCloseMessage } from "./position-notify.js";

function now() {
  return new Date().toISOString();
}

function log(msg) {
  console.log(`[${now()}] ${msg}`);
}

export async function runCycle(client, { liveClose, discover }, inflight, options = {}) {
  const { notifier, tracker } = options;
  const data = await client.positions({ discover });
  const list = Array.isArray(data.positions) ? data.positions : [];
  const open = list.filter((p) => !p.closed_on_chain && !p.readonly);
  let hits = 0;

  for (const p of open) {
    log(watchLine(p));
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
      if (tracker) tracker.markWorkerClosed(key);
      if (notifier?.isEnabled()) {
        const msg = formatCloseMessage({
          position: p,
          kind: decision.kind,
          reason: decision.reason,
          dry: true,
        });
        await notifier.send(msg);
      }
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
      if (tracker) tracker.markWorkerClosed(key);
      if (notifier?.isEnabled()) {
        const msg = formatCloseMessage({
          position: p,
          kind: decision.kind,
          reason: decision.reason,
          tx: ok ? (result.tx || result.txs?.[0] || "") : null,
          error: !ok ? (result.error || result.message || "unknown") : null,
          dry: false,
        });
        await notifier.send(msg);
      }
      if (!ok) inflight.delete(key);
    } catch (err) {
      inflight.delete(key);
      log(`close error ${p.pair || p.position}: ${err.message}`);
      if (notifier?.isEnabled()) {
        const msg = formatCloseMessage({
          position: p,
          kind: decision.kind,
          reason: decision.reason,
          error: err.message,
          dry: false,
        });
        await notifier.send(msg);
      }
    }
  }

  if (tracker) {
    await tracker.notifyCycle({ open, discover, notifier });
  }

  return { count: open.length, hits };
}

export async function startWorker(cfg, client, options = {}) {
  const { notifier, tracker = createPositionTracker() } = options;
  await client.login();
  log(`logged in as ${cfg.email} wallet ${cfg.address}`);
  log(
    cfg.liveClose
      ? "LIVE_CLOSE=1 — will close when SL/TP hits"
      : "LIVE_CLOSE=0 — watch only. Set LIVE_CLOSE=1 in .env to close.",
  );
  if (notifier?.isEnabled()) {
    log("Telegram notifications enabled");
  }

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
      const { count, hits } = await runCycle(
        client,
        { liveClose: cfg.liveClose, discover },
        inflight,
        { notifier, tracker },
      );
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

