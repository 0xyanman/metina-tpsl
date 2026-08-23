import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { closePayload, evaluateExit, positionKey } from "../src/evaluate-exit.js";

describe("TP/SL rules (same as Metina Pro desk)", () => {
  test("hits stop loss when on-chain PnL is reliable", () => {
    const hit = evaluateExit({
      poolType: "uniswap",
      pnl: { pnl_pct: -80, pnl_reliable: true },
      pnl_reliable: true,
      stop_loss_pct: -50,
      take_profit_pct: 10,
    });
    assert.equal(hit.action, "close");
    assert.equal(hit.kind, "stop_loss");
  });

  test("skips unreliable PnL", () => {
    const skip = evaluateExit({
      poolType: "uniswap",
      pnl: { pnl_pct: -80 },
      stop_loss_pct: -50,
    });
    assert.equal(skip.action, null);
  });

  test("uses on-chain pct, not indexer overlay", () => {
    const displayNotHit = evaluateExit({
      poolType: "uniswap",
      pnl_reliable: true,
      pnl: { pnl_pct: -80, onchain_pnl_pct: -4.52, pnl_reliable: true },
      stop_loss_pct: -50,
      take_profit_pct: 10,
    });
    assert.equal(displayNotHit.action, null);

    const onchainHit = evaluateExit({
      poolType: "uniswap",
      pnl_reliable: true,
      pnl: { pnl_pct: -4.52, onchain_pnl_pct: -80, pnl_reliable: true },
      stop_loss_pct: -50,
      take_profit_pct: 10,
    });
    assert.equal(onchainHit.kind, "stop_loss");
  });

  test("empty thresholds do not use hidden defaults", () => {
    const empty = evaluateExit({
      poolType: "uniswap",
      pnl_reliable: true,
      pnl: { pnl_pct: -80, pnl_reliable: true },
      stop_loss_pct: "",
      take_profit_pct: "",
    });
    assert.equal(empty.action, null);
  });

  test("principal-seeded entry does not trip TP", () => {
    const seeded = evaluateExit({
      poolType: "uniswap",
      entry_seeded_from_principal: true,
      pnl_reliable: true,
      pnl: { pnl_pct: 1200, pnl_reliable: true },
      take_profit_pct: 10,
    });
    assert.equal(seeded.action, null);
  });

  test("hits take profit", () => {
    const hit = evaluateExit({
      poolType: "uniswap",
      pnl_reliable: true,
      pnl: { onchain_pnl_pct: 25, pnl_reliable: true },
      stop_loss_pct: -40,
      take_profit_pct: 20,
    });
    assert.equal(hit.kind, "take_profit");
  });

  test("positionKey is stable", () => {
    assert.equal(
      positionKey({ poolType: "uniswap", chain: "bsc", position: "99" }),
      "uniswap-bsc-99",
    );
  });

  test("closePayload maps the desk close body", () => {
    const body = closePayload({
      poolType: "uniswap",
      position: "77",
      chain: "bsc",
      pair: "CAT-USDT",
      pool: "0xpool",
      mint: "0xtoken",
      fee: 3000,
      version: "v3",
      dex: "pancake",
    }, { swap: true, kind: "take_profit" });
    assert.equal(body.venue, "uniswap");
    assert.equal(body.position, "77");
    assert.equal(body.tokenId, "77");
    assert.equal(body.kind, "take_profit");
    assert.equal(body.swap, true);
  });

  test("skips readonly and already-closed rows", () => {
    assert.equal(evaluateExit({ readonly: true, stop_loss_pct: -10, pnl_reliable: true, pnl: { pnl_pct: -80, pnl_reliable: true } }).action, null);
    assert.equal(evaluateExit({ closed_on_chain: true, stop_loss_pct: -10, pnl_reliable: true, pnl: { pnl_pct: -80, pnl_reliable: true } }).action, null);
  });
});
