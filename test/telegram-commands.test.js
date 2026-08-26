import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { handleTelegramCommand } from "../src/worker.js";

describe("handleTelegramCommand", () => {
  test("/help sends help instructions", async () => {
    const sent = [];
    const notifier = {
      send: async (msg) => {
        sent.push(msg);
        return { ok: true };
      },
    };

    await handleTelegramCommand(
      { cmd: "/help", args: [], raw: "/help" },
      { client: {}, notifier, tracker: null, inflight: new Set() }
    );

    assert.equal(sent.length, 1);
    assert.match(sent[0], /Metina TPSL Bot Commands/);
  });

  test("/refresh fetches positions with discover=true and sends summary", async () => {
    const sent = [];
    const notifier = {
      send: async (msg) => {
        sent.push(msg);
        return { ok: true };
      },
    };

    let capturedDiscover = false;
    const client = {
      positions: async ({ discover }) => {
        capturedDiscover = discover;
        return {
          positions: [
            {
              position: "933596",
              pair: "PONSBOT/USDG",
              chain: "robinhood",
            },
          ],
        };
      },
    };

    await handleTelegramCommand(
      { cmd: "/refresh", args: [], raw: "/refresh" },
      { client, notifier, tracker: null, inflight: new Set() }
    );

    assert.equal(capturedDiscover, true);
    assert.equal(sent.length, 2);
    assert.match(sent[0], /Mengambil data posisi/);
    assert.match(sent[1], /Open Positions/);
    assert.match(sent[1], /933596/);
  });

  test("/close 933596 closes specific position", async () => {
    const sent = [];
    const notifier = {
      send: async (msg) => {
        sent.push(msg);
        return { ok: true };
      },
    };

    let closedBody = null;
    const client = {
      positions: async () => ({
        positions: [
          {
            position: "933596",
            pair: "PONSBOT/USDG",
            chain: "robinhood",
          },
        ],
      }),
      close: async (body) => {
        closedBody = body;
        return { ok: true, tx: "0x123" };
      },
    };

    const inflight = new Set();
    await handleTelegramCommand(
      { cmd: "/close", args: ["933596"], raw: "/close 933596" },
      { client, notifier, tracker: null, inflight }
    );

    assert.equal(closedBody.position, "933596");
    assert.equal(inflight.size, 0); // cleaned up after close
    assert.equal(sent.length, 2);
    assert.match(sent[0], /Memproses penutupan posisi/);
    assert.match(sent[1], /Position Closed/);
  });

  test("/close invalid_id reports position not found", async () => {
    const sent = [];
    const notifier = {
      send: async (msg) => {
        sent.push(msg);
        return { ok: true };
      },
    };

    const client = {
      positions: async () => ({
        positions: [
          { position: "933596", pair: "PONSBOT/USDG" },
        ],
      }),
    };

    await handleTelegramCommand(
      { cmd: "/close", args: ["999999"], raw: "/close 999999" },
      { client, notifier, tracker: null, inflight: new Set() }
    );

    assert.equal(sent.length, 1);
    assert.match(sent[0], /tidak ditemukan/);
  });

  test("/close all closes all open positions", async () => {
    const sent = [];
    const notifier = {
      send: async (msg) => {
        sent.push(msg);
        return { ok: true };
      },
    };

    const closedBodies = [];
    const client = {
      positions: async () => ({
        positions: [
          { position: "101", pair: "AAA/USD" },
          { position: "102", pair: "BBB/USD" },
        ],
      }),
      close: async (body) => {
        closedBodies.push(body);
        return { ok: true, tx: "0x123" };
      },
    };

    const inflight = new Set();
    await handleTelegramCommand(
      { cmd: "/close", args: ["all"], raw: "/close all" },
      { client, notifier, tracker: null, inflight }
    );

    assert.equal(closedBodies.length, 2);
    assert.equal(inflight.size, 0);
    assert.equal(sent.length, 3); // 1 summary start message + 2 position close messages
    assert.match(sent[0], /Memproses penutupan <b>2 posisi open<\/b>/);
  });

  test("/close profit discovers latest positions and closes only profitable ones", async () => {
    const sent = [];
    const notifier = {
      send: async (msg) => {
        sent.push(msg);
        return { ok: true };
      },
    };

    let capturedDiscover = false;
    const closedBodies = [];
    const client = {
      positions: async ({ discover }) => {
        capturedDiscover = discover;
        return {
          positions: [
            { position: "101", pair: "PROFIT/USD", pnl: { pnl_pct: 12.5, pnl_usd: 5.0 } },
            { position: "102", pair: "LOSS/USD", pnl: { pnl_pct: -8.0, pnl_usd: -2.0 } },
          ],
        };
      },
      close: async (body) => {
        closedBodies.push(body);
        return { ok: true, tx: "0x789" };
      },
    };

    const inflight = new Set();
    await handleTelegramCommand(
      { cmd: "/close", args: ["profit"], raw: "/close profit" },
      { client, notifier, tracker: null, inflight }
    );

    assert.equal(capturedDiscover, true); // Verified that discover: true was used!
    assert.equal(closedBodies.length, 1);
    assert.equal(closedBodies[0].position, "101");
    assert.equal(sent.length, 2); // 1 start message + 1 close result
    assert.match(sent[0], /Memproses penutupan <b>1 posisi profit<\/b>/);
  });

  test("/close profit notifies when no open positions are in profit", async () => {
    const sent = [];
    const notifier = {
      send: async (msg) => {
        sent.push(msg);
        return { ok: true };
      },
    };

    const client = {
      positions: async ({ discover }) => {
        return {
          positions: [
            { position: "102", pair: "LOSS/USD", pnl: { pnl_pct: -8.0, pnl_usd: -2.0 } },
          ],
        };
      },
    };

    await handleTelegramCommand(
      { cmd: "/close", args: ["profit"], raw: "/close profit" },
      { client, notifier, tracker: null, inflight: new Set() }
    );

    assert.equal(sent.length, 1);
    assert.match(sent[0], /Tidak ada posisi open yang sedang profit/);
  });
});
