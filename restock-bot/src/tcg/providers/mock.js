// APIキーなしで動作を確認するためのデモ用相場（架空の数字）。
const PRICES = {
  'demo-pokemon-box-a': { priceUsd: 89.0, change7dPct: 6.2 },
  'demo-pokemon-box-b': { priceUsd: 52.0, change7dPct: -3.1 },
  'demo-pokemon-special-set': { priceUsd: 74.5, change7dPct: 12.4 },
  'demo-onepiece-box-a': { priceUsd: 118.0, change7dPct: 2.0 },
  'demo-onepiece-box-b': { priceUsd: 61.0, change7dPct: -8.5 },
};

export function fetchMockPrice(product) {
  const p = PRICES[product.id];
  if (!p) return null;
  return { ...p, avg30dUsd: null, lastUpdated: new Date().toISOString(), source: 'demo', name: product.name.en };
}
