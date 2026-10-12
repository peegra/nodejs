const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Discord Webhook へ送信する。レート制限（429）のときは指示された秒数だけ待って再送する。
export async function sendDiscord(webhookUrl, payload, { retries = 3 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowed_mentions: { parse: [] }, ...payload }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) return;

    if (res.status === 429 && attempt < retries) {
      const body = await res.json().catch(() => ({}));
      await sleep(Math.ceil((body.retry_after ?? 1) * 1000));
      continue;
    }
    throw new Error(`Discord 送信失敗: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
}
