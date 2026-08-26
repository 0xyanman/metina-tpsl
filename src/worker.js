import { closePayload, evaluateExit, livePnlPct, positionKey, watchLine } from "./evaluate-exit.js";
import { createPositionTracker, formatCloseMessage, formatOpenSummary, formatHelpMessage } from "./position-notify.js";
import { escapeHtml } from "./telegram.js";

function now() {
  return new Date().toISOString();
}

function log(msg) {
  console.log(`[${now()}] ${msg}`);
}

async function getOpenPositions(client, discover = false) {
  const data = await client.positions({ discover });
  const list = Array.isArray(data?.positions) ? data.positions : [];
  return list.filter((p) => !p.closed_on_chain && !p.readonly);
}

async function handleHelpCommand(notifier) {
  await notifier?.send(formatHelpMessage());
}

async function handleRefreshCommand(client, notifier) {
  await notifier?.send("⏳ Mengambil data posisi terbaru...");
  const open = await getOpenPositions(client, true);
  if (open.length === 0) {
    await notifier?.send("📂 Tidak ada posisi open saat ini.");
    return;
  }
  const summary = formatOpenSummary(open);
  await notifier?.send(summary);
}

async function closePosition(client, notifier, tracker, inflight, pos, { reason, closeReason, notifyStart = false }) {
  const key = positionKey(pos);
  if (inflight.has(key)) {
    await notifier?.send(`⚠️ Posisi ${escapeHtml(pos.pair || pos.position)} sedang dalam proses closing.`);
    return;
  }

  inflight.add(key);
  if (notifyStart) {
    const posIdLabel = pos.position || pos.tokenId || "";
    await notifier?.send(
      `⏳ Memproses penutupan posisi <b>${escapeHtml(pos.pair || pos.position)}</b> (ID: <code>${escapeHtml(posIdLabel)}</code>)...`
    );
  }

  try {
    const result = await client.close(
      closePayload(pos, {
        swap: true,
        kind: "manual",
        close_reason: closeReason,
      })
    );
    const ok = result?.success || result?.ok;
    if (tracker) tracker.markWorkerClosed(key);
    await notifier?.send(
      formatCloseMessage({
        position: pos,
        kind: "manual",
        reason,
        tx: ok ? result.tx || result.txs?.[0] || "" : null,
        error: !ok ? result.error || result.message || "unknown" : null,
        dry: false,
      })
    );
  } catch (err) {
    await notifier?.send(
      formatCloseMessage({
        position: pos,
        kind: "manual",
        reason,
        error: err.message,
        dry: false,
      })
    );
  } finally {
    inflight.delete(key);
  }
}

async function handleCloseAll(client, notifier, tracker, inflight, open) {
  await notifier?.send(`⏳ Memproses penutupan <b>${open.length} posisi open</b>...`);
  for (const p of open) {
    await closePosition(client, notifier, tracker, inflight, p, {
      reason: "Command /close all",
      closeReason: "telegram_command_all",
      notifyStart: false,
    });
  }
}

async function handleCloseProfit(client, notifier, tracker, inflight) {
  const open = await getOpenPositions(client, true);
  if (open.length === 0) {
    await notifier?.send("⚠️ Tidak ada posisi open yang bisa ditutup.");
    return;
  }

  const profitPositions = open.filter((p) => {
    const pct = livePnlPct(p);
    const usd = p?.pnl?.pnl_usd ?? p?.pnl_usd;
    return (pct != null && pct > 0) || (usd != null && Number(usd) > 0);
  });

  if (profitPositions.length === 0) {
    await notifier?.send("📂 Tidak ada posisi open yang sedang profit saat ini.");
    return;
  }

  await notifier?.send(`⏳ Memproses penutupan <b>${profitPositions.length} posisi profit</b>...`);
  for (const p of profitPositions) {
    await closePosition(client, notifier, tracker, inflight, p, {
      reason: "Command /close profit",
      closeReason: "telegram_command_profit",
      notifyStart: false,
    });
  }
}

async function handleCloseSpecific(client, notifier, tracker, inflight, open, target) {
  const pos = open.find((p, idx) => {
    const pId = String(p.position || p.tokenId || "").toLowerCase();
    return pId === target || String(idx + 1) === target;
  });

  if (!pos) {
    await notifier?.send(`⚠️ Posisi dengan ID/Nomor <code>${escapeHtml(target)}</code> tidak ditemukan dalam open list.`);
    return;
  }

  await closePosition(client, notifier, tracker, inflight, pos, {
    reason: `Command /close ${target}`,
    closeReason: `telegram_command_${target}`,
    notifyStart: true,
  });
}

async function handleCloseCommand(parsed, { client, notifier, tracker, inflight }) {
  const target = (parsed.args[0] || "all").trim().toLowerCase();

  if (target === "profit" || target === "untung" || target === "tp") {
    await handleCloseProfit(client, notifier, tracker, inflight);
    return;
  }

  const open = await getOpenPositions(client, false);

  if (open.length === 0) {
    await notifier?.send("⚠️ Tidak ada posisi open yang bisa ditutup.");
    return;
  }

  if (target === "all" || target === "*") {
    await handleCloseAll(client, notifier, tracker, inflight, open);
  } else {
    await handleCloseSpecific(client, notifier, tracker, inflight, open, target);
  }
}

export async function handleTelegramCommand(parsed, context) {
  const { cmd } = parsed;

  if (cmd === "/help" || cmd === "/start") {
    await handleHelpCommand(context.notifier);
    return;
  }

  if (cmd === "/refresh") {
    await handleRefreshCommand(context.client, context.notifier);
    return;
  }

  if (cmd === "/close") {
    await handleCloseCommand(parsed, context);
  }
}

export async function runCycle(client, { liveClose, discover }, inflight, options = {}) {
  const { notifier, tracker } = options;
  const open = await getOpenPositions(client, discover);
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

  if (notifier?.isEnabled() && typeof notifier.startCommandPoller === "function") {
    notifier.startCommandPoller(async (parsed) => {
      try {
        await handleTelegramCommand(parsed, { client, notifier, tracker, inflight, liveClose: cfg.liveClose });
      } catch (err) {
        log(`telegram command error: ${err.message}`);
      }
    });
    log("Telegram command listener started (/refresh, /close, /help)");
  }

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


