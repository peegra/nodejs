import { fetchWithTimeout } from './http.js';

// 楽天市場商品検索API。在庫切れの商品も取得して「在庫なし → あり」を検知する。
// 検索APIは商品単位の在庫しか返さない（サイズ別の在庫は取れない）。
export async function fetchRakuten(watch, env) {
  const { applicationId, affiliateId, endpoint } = env.rakuten;
  if (!applicationId) throw new Error('RAKUTEN_APPLICATION_ID が未設定です');

  const q = watch.query ?? {};
  const params = new URLSearchParams({
    applicationId,
    format: 'json',
    formatVersion: '2',
    keyword: q.keyword ?? '',
    hits: String(q.hits ?? 30),
    sort: q.sort ?? '-updateTimestamp',
    availability: '0',
  });
  if (affiliateId) params.set('affiliateId', affiliateId);
  if (q.minPrice) params.set('minPrice', String(q.minPrice));
  if (q.maxPrice) params.set('maxPrice', String(q.maxPrice));
  if (q.genreId) params.set('genreId', String(q.genreId));
  if (q.shopCode) params.set('shopCode', q.shopCode);

  const res = await fetchWithTimeout(`${endpoint}?${params}`);
  const data = await res.json();
  return parseRakuten(data);
}

export function parseRakuten(data) {
  return (data.Items ?? []).map((raw) => {
    const it = raw.Item ?? raw; // formatVersion 1 と 2 の両方に対応
    const image = it.mediumImageUrls?.[0];
    return {
      id: it.itemCode,
      title: it.itemName,
      variant: null,
      price: it.itemPrice,
      currency: 'JPY',
      available: it.availability === 1,
      url: it.itemUrl,
      affiliateUrl: it.affiliateUrl || null,
      image: typeof image === 'string' ? image : image?.imageUrl ?? null,
      shop: it.shopName ?? null,
    };
  });
}
