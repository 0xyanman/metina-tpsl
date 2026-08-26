export function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function parseTelegramCommand(text) {
  if (typeof text !== "string" || !text.startsWith("/")) return null;
  const parts = text.trim().split(/\s+/);
  const rawCmd = parts[0].toLowerCase();
  const cmd = rawCmd.split("@")[0];
  const args = parts.slice(1);
  return { cmd, args, raw: text };
}

function isTargetChat(msg, chatId, threadId) {
  const incomingChatId = String(msg?.chat?.id || "");
  if (incomingChatId !== String(chatId)) return false;

  if (threadId != null && threadId !== "") {
    const incomingThreadId = msg?.message_thread_id;
    if (String(incomingThreadId || "") !== String(threadId)) return false;
  }
  return true;
}

async function processSingleUpdate(update, { chatId, threadId, onCommand }) {
  const msg = update?.message || update?.channel_post;
  if (!msg?.text) return;
  if (!isTargetChat(msg, chatId, threadId)) return;

  const parsed = parseTelegramCommand(msg.text);
  if (parsed) {
    await onCommand(parsed, msg);
  }
}

export function createTelegramNotifier(options = {}) {
  const {
    token = "",
    chatId = "",
    threadId = null,
    enabled = true,
    fetchFn = globalThis.fetch,
  } = options || {};

  const isConfigured = Boolean(token && chatId && enabled);

  async function send(text) {
    if (!isConfigured || !text) return { ok: false, skipped: true };

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text: String(text),
      parse_mode: "HTML",
    };

    if (threadId != null && threadId !== "") {
      payload.message_thread_id = Number(threadId) || threadId;
    }

    try {
      const res = await fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        const desc = data.description || `HTTP ${res.status}`;
        console.error(`[Telegram] send failed: ${desc}`);
        return { ok: false, error: desc };
      }
      return { ok: true, result: data.result };
    } catch (err) {
      console.error(`[Telegram] network error: ${err.message}`);
      return { ok: false, error: err.message };
    }
  }

  async function pollUpdates(offset = 0, timeout = 5) {
    if (!isConfigured) return [];
    const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=${timeout}`;
    try {
      const res = await fetchFn(url);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && Array.isArray(data.result)) {
        return data.result;
      }
    } catch {
      // ignore network glitch in poller
    }
    return [];
  }

  function startCommandPoller(onCommand, pollIntervalMs = 2000) {
    if (!isConfigured || typeof onCommand !== "function") return () => {};

    let offset = 0;
    const state = { running: true };

    const loop = async () => {
      while (state.running) {
        try {
          const updates = await pollUpdates(offset, 5);
          if (!state.running) break;
          for (const update of updates) {
            if (update?.update_id >= offset) {
              offset = update.update_id + 1;
            }
            await processSingleUpdate(update, { chatId, threadId, onCommand });
          }
        } catch (err) {
          console.error(`[Telegram poller] error: ${err.message}`);
        }
        if (!state.running) break;
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    };

    loop();

    return () => {
      state.running = false;
    };
  }

  return {
    isEnabled: () => isConfigured,
    send,
    pollUpdates,
    startCommandPoller,
  };
}
