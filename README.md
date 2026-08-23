# Metina TP/SL (24h)

24/7 take-profit / stop-loss worker for [Metina Pro](https://pro.metina.id). You run it on **your** machine or VPS. Metina Pro **does not store your private key**.

---

## English

Small worker that members run on their own computer / VPS.

The key lives only in your `.env` on that machine. This replaces the desk tab that had to stay open.

Set SL/TP on the Metina Pro Open positions card. The worker only checks and closes when a level is hit.

### Setup

Needs Node 18+.

```bash
cp .env.example .env
```

Fill `.env`:

- `METINA_EMAIL` / `METINA_PASSWORD` — your Pro account
- `EVM_PRIVATE_KEY` — LP wallet key (never commit this)
- RPCs for the chains you use (`RPC_BSC`, `RPC_BASE`, `RPC_ROBINHOOD`)
- `LIVE_CLOSE=0` first (watch-only)

```bash
npm install
npm start
```

When logs show `DRY stop loss …` and look correct, switch to:

```
LIVE_CLOSE=1
```

Then `npm start` again. The process must **stay running** (VPS, Railway, `pm2`).

```bash
pm2 start src/index.js --name metina-tpsl
```

### Notes

- Stop the worker = TP/SL is off (same as closing the desk tab).
- A position card with empty SL/TP will not close.
- Unreliable on-chain PnL is skipped (avoids a false close).
- `LIVE_CLOSE=0` only logs; it does not send close.
- The key is sent to Metina **only on close**, in request memory. It is not saved in the database.

### Deploy

**Vercel is a poor fit.** `npm start` is a long-running loop; Vercel kills it. Hobby cron runs once a day. Pro cron can run every minute, but close+swap may hit function timeouts.

Use a VPS, Railway, Render, or `pm2` on a box that stays up.

This folder is a **separate project**. Do not put a member `.env` on the Metina Pro server.

---

## Bahasa Indonesia

Worker kecil yang member jalanin **di komputer / VPS mereka sendiri**.

Metina Pro **tidak menyimpan private key**. Key cuma ada di file `.env` di mesin member. Worker ini pengganti tab desk yang harus tetap kebuka.

SL/TP tetap diisi di kartu posisi Metina Pro (Open positions). Worker hanya ngecek dan nge-close kalau kena.

### Cara pakai

Butuh Node 18+.

```bash
cp .env.example .env
```

Isi `.env`:

- `METINA_EMAIL` / `METINA_PASSWORD` — akun Pro
- `EVM_PRIVATE_KEY` — key wallet LP (jangan di-commit)
- RPC chain yang dipakai (`RPC_BSC`, `RPC_BASE`, `RPC_ROBINHOOD`)
- `LIVE_CLOSE=0` dulu (mode lihat dulu)

```bash
npm install
npm start
```

Kalau log `DRY stop loss …` sudah benar, baru ganti:

```
LIVE_CLOSE=1
```

Lalu `npm start` lagi. Proses ini harus **tetap hidup** (VPS, Railway, `pm2`).

```bash
pm2 start src/index.js --name metina-tpsl
```

### Yang perlu diingat

- Tutup worker = TP/SL mati (sama seperti tutup tab).
- Kartu posisi tanpa SL/TP = tidak di-close.
- PnL on-chain belum valid = skip (supaya tidak salah tembak).
- `LIVE_CLOSE=0` tidak mengirim close, cuma log.
- Key dikirim ke Metina **hanya saat close**, di memori request, tidak disimpan di database.

### Deploy

**Vercel kurang cocok.** `npm start` adalah proses yang harus hidup terus; Vercel mematikannya. Cron Hobby cuma 1x sehari. Cron Pro bisa tiap menit, tapi close+swap bisa kena timeout.

Pakai VPS, Railway, Render, atau `pm2` di mesin yang nyala 24 jam.

Folder ini **project terpisah**. Jangan taruh `.env` member ke server Metina Pro.
