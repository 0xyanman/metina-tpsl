/**
 * Same rules as Metina Pro desk Auto TP/SL.
 * Only user-set thresholds. Empty SL/TP does not use hidden -50 / +10.
 */

function num(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function positionKey(p) {
  const venue = String(p?.poolType || p?.venue || "uniswap").toLowerCase();
  const chain = String(p?.chain || "").toLowerCase();
  return `${venue}-${chain}-${p?.position || p?.tokenId || ""}`;
}

export function evaluateExit(position) {
  if (!position || position.closed_on_chain || position.readonly) {
    return { action: null, reason: null, kind: null };
  }
  const venue = String(position.poolType || position.venue || "").toLowerCase();
  const pnl = position.pnl && typeof position.pnl === "object" ? position.pnl : {};

  const sl = num(position.stop_loss_pct);
  const tp = num(position.take_profit_pct);

  let pnlPct;
  if (venue !== "dlmm") {
    if (
      position.entry_seeded_from_principal === true
      || pnl.entry_seeded_from_principal === true
    ) {
      return { action: null, reason: null, kind: null };
    }
    const onchain = num(pnl.onchain_pnl_pct ?? position.onchain_pnl_pct);
    const display = num(pnl.pnl_pct ?? position.pnl_pct);
    // V4 / LPAgent often has an on-chain % but Pro flags it unreliable
    // (no deposit cost basis). Still honor user-set SL/TP on that mark.
    // Never close on indexer-only display % unless the row is marked reliable.
    pnlPct = onchain;
    if (
      pnlPct == null
      && position.pnl_reliable === true
      && pnl.pnl_reliable !== false
    ) {
      pnlPct = display;
    }
  } else {
    pnlPct = num(pnl.pnl_pct ?? position.pnl_pct ?? pnl.pnl_sol_pct);
  }
  if (pnlPct == null) return { action: null, reason: null, kind: null };

  if (Number.isFinite(sl) && pnlPct <= sl) {
    return {
      action: "close",
      kind: "stop_loss",
      reason: `stop loss ${pnlPct.toFixed(2)}% <= ${sl}%`,
    };
  }
  if (Number.isFinite(tp) && pnlPct >= tp) {
    return {
      action: "close",
      kind: "take_profit",
      reason: `take profit ${pnlPct.toFixed(2)}% >= ${tp}%`,
    };
  }
  return { action: null, reason: null, kind: null };
}

export function watchLine(position) {
  const pnl = position?.pnl && typeof position.pnl === "object" ? position.pnl : {};
  const hit = evaluateExit(position);
  const onchain = num(pnl.onchain_pnl_pct ?? position?.onchain_pnl_pct);
  const display = num(pnl.pnl_pct ?? position?.pnl_pct);
  const tp = num(position?.take_profit_pct);
  const sl = num(position?.stop_loss_pct);
  const pct = onchain != null ? onchain.toFixed(2) : "—";
  const tpLabel = tp != null ? ` tp=${tp}` : "";
  const slLabel = sl != null ? ` sl=${sl}` : "";
  const state = hit.kind || (onchain == null && display == null ? "no-pnl" : "watch");
  return `${position?.pair || position?.position}${slLabel}${tpLabel} onchain=${pct} ${state}`;
}

export function closePayload(p, extra = {}) {
  return {
    venue: String(p.poolType || p.venue || "uniswap").toLowerCase() === "dlmm" ? "dlmm" : "uniswap",
    position: p.position || p.tokenId,
    tokenId: p.position || p.tokenId,
    chain: p.chain,
    pair: p.pair,
    pool: p.pool,
    mint: p.mint || p.base_mint,
    fee: p.fee,
    version: p.version,
    dex: p.dex,
    snapshot: p,
    ...extra,
  };
}
