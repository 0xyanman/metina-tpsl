import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { runCycle } from "../src/worker.js";

describe("worker cycle", () => {
  test("does not call close when LIVE_CLOSE is off", async () => {
    let closed = 0;
    const client = {
      async positions() {
        return {
          positions: [{
            poolType: "uniswap",
            chain: "bsc",
            position: "1",
            pair: "TEST-USDT",
            pnl_reliable: true,
            pnl: { onchain_pnl_pct: -80, pnl_reliable: true },
            stop_loss_pct: -50,
            take_profit_pct: 10,
          }],
        };
      },
      async close() {
        closed += 1;
        return { ok: true, success: true };
      },
    };
    const out = await runCycle(client, { liveClose: false, discover: false }, new Set());
    assert.equal(out.count, 1);
    assert.equal(out.hits, 1);
    assert.equal(closed, 0);
  });

  test("closes once when live and SL hits", async () => {
    let closed = 0;
    const client = {
      async positions() {
        return {
          positions: [{
            poolType: "uniswap",
            chain: "base",
            position: "2",
            pair: "MEME-USDC",
            pnl_reliable: true,
            pnl: { onchain_pnl_pct: -80, pnl_reliable: true },
            stop_loss_pct: -50,
          }],
        };
      },
      async close(body) {
        closed += 1;
        assert.equal(body.kind, "stop_loss");
        assert.equal(body.swap, true);
        return { ok: true, success: true, tx: "0xabc" };
      },
    };
    const inflight = new Set();
    const out = await runCycle(client, { liveClose: true, discover: false }, inflight);
    assert.equal(out.hits, 1);
    assert.equal(closed, 1);
    assert.equal(inflight.has("uniswap-base-2"), true);
  });

  test("does not close a position already in-flight", async () => {
    let closed = 0;
    const client = {
      async positions() {
        return {
          positions: [{
            poolType: "uniswap",
            chain: "base",
            position: "2",
            pair: "MEME-USDC",
            pnl_reliable: true,
            pnl: { onchain_pnl_pct: -80, pnl_reliable: true },
            stop_loss_pct: -50,
          }],
        };
      },
      async close() {
        closed += 1;
        return { ok: true, success: true };
      },
    };
    const inflight = new Set(["uniswap-base-2"]);
    await runCycle(client, { liveClose: true, discover: false }, inflight);
    assert.equal(closed, 0);
  });

  test("failed close leaves the position retryable", async () => {
    let closed = 0;
    const client = {
      async positions() {
        return {
          positions: [{
            poolType: "uniswap",
            chain: "bsc",
            position: "3",
            pair: "FAIL-USDT",
            pnl_reliable: true,
            pnl: { onchain_pnl_pct: -80, pnl_reliable: true },
            stop_loss_pct: -50,
          }],
        };
      },
      async close() {
        closed += 1;
        return { ok: false, success: false, error: "rpc down" };
      },
    };
    const inflight = new Set();
    await runCycle(client, { liveClose: true, discover: false }, inflight);
    assert.equal(closed, 1);
    assert.equal(inflight.has("uniswap-bsc-3"), false);
  });
});
