const BASE_URL = 'https://api.justtcg.com/v1';

// JustTCG API（https://justtcg.com/docs）から海外（米国）の相場を取る。
// product.market = { provider: 'justtcg', cardId, condition?, language?, printing? }
export async function fetchJustTcg(product, env) {
  if (!env.justtcgApiKey) throw new Error('JUSTTCG_API_KEY が未設定です');
  const m = product.market ?? {};
  if (!m.cardId) throw new Error(`${product.id}: market.cardId（JustTCG のカードID）が必要です`);

  const params = new URLSearchParams({ cardId: m.cardId });
  if (m.condition) params.set('condition', m.condition);
  if (m.language) params.set('language', m.language);
  if (m.printing) params.set('printing', m.printing);

  const res = await fetch(`${BASE_URL}/cards?${params}`, {
    headers: { 'x-api-key': env.justtcgApiKey },
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`JustTCG HTTP ${res.status} ${body.error ?? ''}`.trim());
  return pickVariant(body.data?.[0], m);
}

// 条件（状態・言語・印刷）に合うバリエーションから、価格のあるものを選ぶ。
export function pickVariant(card, m = {}) {
  if (!card) return null;
  const want = (v, key) => !m[key] || (v[key] ?? '').toLowerCase() === m[key].toLowerCase();
  const variant = (card.variants ?? [])
    .filter((v) => v.price != null && want(v, 'condition') && want(v, 'language') && want(v, 'printing'))
    .sort((a, b) => (b.lastUpdated ?? 0) - (a.lastUpdated ?? 0))[0];
  if (!variant) return null;
  return {
    priceUsd: variant.price,
    change7dPct: variant.priceChange7d ?? null,
    avg30dUsd: variant.avgPrice30d ?? null,
    lastUpdated: variant.lastUpdated ? new Date(variant.lastUpdated * 1000).toISOString() : null,
    source: 'JustTCG',
    name: card.name,
  };
}
