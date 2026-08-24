# Metina TP/SL (24h)

24/7 take-profit / stop-loss worker for [Metina Pro](https://pro.metina.id). You run it on **your** machine or VPS. Metina Pro **does not store your private key**.

---

## English

Small worker that members run on their own computer / VPS.

The key lives only in your `.env` on that machine. This replaces the desk tab that had to stay open.

Set SL/TP on the Metina Pro Open positions card. The worker only checks and closes when a level is hit.

### Before you start

1. An active [Metina Pro](https://pro.metina.id) account (email + password).
2. Vault / LP wallet private key (`0x` + 64 hex chars).
3. The same RPC URLs as Metina Settings (BSC / Base / Robinhood). Settings keeps them in the browser only — copy them into `.env`. Fill every chain you have positions on.
4. Node 18+ if you run it on your laptop. Or a Railway / VPS account if you want 24h without leaving a laptop on.
5. On the Pro desk: open **Open positions**, fill **SL** and **TP** on each card you want protected. Empty SL/TP = the worker will not close that position.

`LIVE_CLOSE=0` means **watch only**. The worker logs `DRY stop loss …` and does not send a close. `LIVE_CLOSE=1` actually closes + swaps, same as the Close button.

**Do not use Vercel.** `npm start` is a long-running loop; Vercel kills it. Hobby cron is once a day.

### A. Laptop (test first)

```bash
git clone https://github.com/0xyanman/metina-tpsl.git
cd metina-tpsl
cp .env.example .env
```

Edit `.env` (never commit this file):

```
METINA_URL=https://pro.metina.id
METINA_EMAIL=you@email.com
METINA_PASSWORD=your-pro-password
EVM_PRIVATE_KEY=0xyourkey
RPC_BSC=https://…
RPC_BASE=https://…
RPC_ROBINHOOD=https://…
LIVE_CLOSE=0
```

```bash
npm install
npm start
```

Leave the terminal open. Every ~45s you should see:

```
logged in as you@email.com wallet 0x…
LIVE_CLOSE=0 — watch only. Set LIVE_CLOSE=1 in .env to close.
watch 2 open · hits 0
```

If a position is past SL/TP you will see `DRY stop loss PAIR …` — still no close.

When that looks right, stop with `Ctrl+C`, set `LIVE_CLOSE=1`, then `npm start` again. Closing the terminal or sleeping the laptop **stops** TP/SL. For 24h, use Railway or a VPS.

### B. Railway (easiest 24h)

1. Open [railway.app](https://railway.app) and sign in with GitHub.
2. **New project** → **Deploy from GitHub repo** → `0xyanman/metina-tpsl`  
   (fork the repo to your GitHub first if you cannot deploy someone else's repo).
3. Open the service → **Variables** and add the same keys as `.env`:
   - `METINA_URL` = `https://pro.metina.id`
   - `METINA_EMAIL`
   - `METINA_PASSWORD`
   - `EVM_PRIVATE_KEY`
   - `RPC_BSC` / `RPC_BASE` / `RPC_ROBINHOOD` (required — every chain you use)
   - `LIVE_CLOSE` = `0`
4. Start command is already `npm start` (`node src/index.js`). No extra build step.
5. Open **Deployments → Logs**. Confirm `logged in` and `watch N open`.
6. When DRY logs look correct, change `LIVE_CLOSE` to `1` and redeploy.

Railway keeps the process up. If the deploy sleeps on a free trial, upgrade or use a VPS.

### C. VPS + pm2 (Ubuntu)

```bash
sudo apt update
sudo apt install -y git nodejs npm
git clone https://github.com/0xyanman/metina-tpsl.git
cd metina-tpsl
cp .env.example .env
nano .env          # fill the same values, start with LIVE_CLOSE=0
npm install
sudo npm install -g pm2
pm2 start src/index.js --name metina-tpsl
pm2 logs metina-tpsl
pm2 startup
pm2 save
```

After DRY logs look correct:

```bash
# in .env set LIVE_CLOSE=1
pm2 restart metina-tpsl
```

```bash
pm2 status          # should stay "online"
pm2 logs metina-tpsl --lines 50
```

### Notes

- Stop the worker = TP/SL is off (same as closing the desk tab).
- A position card with empty SL/TP will not close.
- Unreliable on-chain PnL is skipped (avoids a false close).
- The key is sent to Metina **only on close**, in request memory. It is not saved in the database.
- Settings RPCs live in the member's browser, not the Metina database. The worker must send them from `.env`.
- This folder is a **separate project**. Do not put a member `.env` on the Metina Pro server.

---

## Bahasa Indonesia

Worker kecil yang member jalanin **di komputer / VPS mereka sendiri**.

Metina Pro **tidak menyimpan private key**. Key cuma ada di file `.env` di mesin member. Worker ini pengganti tab desk yang harus tetap kebuka.

SL/TP tetap diisi di kartu posisi Metina Pro (Open positions). Worker hanya ngecek dan nge-close kalau kena.

### Sebelum mulai

1. Akun [Metina Pro](https://pro.metina.id) yang aktif (email + password).
2. Private key wallet LP (`0x` + 64 karakter hex).
3. RPC yang sama seperti di Settings Metina (BSC / Base / Robinhood). Settings cuma simpan di browser — copy ke `.env`. Isi setiap chain yang ada posisinya.
4. Node 18+ kalau dijalankan di laptop. Atau akun Railway / VPS kalau mau 24 jam tanpa laptop nyala.
5. Di desk Pro: buka **Open positions**, isi **SL** dan **TP** di kartu yang mau dilindungi. SL/TP kosong = worker tidak close posisi itu.

`LIVE_CLOSE=0` artinya **mode lihat dulu**. Worker nulis `DRY stop loss …` dan **tidak** mengirim close. `LIVE_CLOSE=1` baru benar-benar close + swap, sama seperti tombol Close.

**Jangan pakai Vercel.** `npm start` harus hidup terus; Vercel mematikannya. Cron Hobby cuma 1x sehari.

### A. Laptop (tes dulu)

```bash
git clone https://github.com/0xyanman/metina-tpsl.git
cd metina-tpsl
cp .env.example .env
```

Isi `.env` (jangan di-commit):

```
METINA_URL=https://pro.metina.id
METINA_EMAIL=kamu@email.com
METINA_PASSWORD=password-pro
EVM_PRIVATE_KEY=0xkeykamu
RPC_BSC=https://…
RPC_BASE=https://…
RPC_ROBINHOOD=https://…
LIVE_CLOSE=0
```

```bash
npm install
npm start
```

Biarkan terminal terbuka. Tiap ~45 detik harus muncul:

```
logged in as kamu@email.com wallet 0x…
LIVE_CLOSE=0 — watch only. Set LIVE_CLOSE=1 in .env to close.
watch 2 open · hits 0
```

Kalau posisi sudah kena SL/TP, yang muncul `DRY stop loss PAIR …` — masih belum close.

Kalau log-nya benar, `Ctrl+C`, ganti `LIVE_CLOSE=1`, lalu `npm start` lagi. Tutup terminal atau HP/laptop tidur = **TP/SL mati**. Untuk 24 jam, pakai Railway atau VPS.

### B. Railway (paling gampang untuk 24 jam)

1. Buka [railway.app](https://railway.app), login dengan GitHub.
2. **New project** → **Deploy from GitHub repo** → `0xyanman/metina-tpsl`  
   (fork dulu ke GitHub kamu kalau tidak bisa deploy repo orang lain).
3. Buka service → **Variables**, isi sama seperti `.env`:
   - `METINA_URL` = `https://pro.metina.id`
   - `METINA_EMAIL`
   - `METINA_PASSWORD`
   - `EVM_PRIVATE_KEY`
   - `RPC_BSC` / `RPC_BASE` / `RPC_ROBINHOOD` (wajib — setiap chain yang dipakai)
   - `LIVE_CLOSE` = `0`
4. Start command sudah `npm start` (`node src/index.js`). Tidak perlu build khusus.
5. Buka **Deployments → Logs**. Pastikan ada `logged in` dan `watch N open`.
6. Kalau log DRY sudah benar, ganti `LIVE_CLOSE` jadi `1` lalu redeploy.

Railway menjaga proses tetap hidup. Kalau trial tidur sendiri, upgrade atau pindah ke VPS.

### C. VPS + pm2 (Ubuntu)

```bash
sudo apt update
sudo apt install -y git nodejs npm
git clone https://github.com/0xyanman/metina-tpsl.git
cd metina-tpsl
cp .env.example .env
nano .env          # isi sama, mulai dari LIVE_CLOSE=0
npm install
sudo npm install -g pm2
pm2 start src/index.js --name metina-tpsl
pm2 logs metina-tpsl
pm2 startup
pm2 save
```

Setelah log DRY benar:

```bash
# di .env ganti LIVE_CLOSE=1
pm2 restart metina-tpsl
```

```bash
pm2 status          # harus "online"
pm2 logs metina-tpsl --lines 50
```

### Yang perlu diingat

- Tutup worker = TP/SL mati (sama seperti tutup tab).
- Kartu posisi tanpa SL/TP = tidak di-close.
- PnL on-chain belum valid = skip (supaya tidak salah tembak).
- Key dikirim ke Metina **hanya saat close**, di memori request, tidak disimpan di database.
- RPC Settings ada di browser member, bukan di database Metina. Worker harus kirim dari `.env`.
- Folder ini **project terpisah**. Jangan taruh `.env` member ke server Metina Pro.
