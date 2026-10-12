const USER_AGENT = 'restock-bot/0.1 (+personal project; contact via repository)';

export async function fetchWithTimeout(url, { timeoutMs = 15000, headers = {} } = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, ...headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${url} ${body.slice(0, 200)}`);
  }
  return res;
}
