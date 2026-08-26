export function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

  return {
    isEnabled: () => isConfigured,
    send,
  };
}
