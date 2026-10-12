import { fetchWithTimeout } from './http.js';

// APIのない公式通販向け。ページ内の文言（「カートに入れる」「在庫切れ」など）で在庫を判定する。
// サイトの利用規約と robots.txt を確認し、間隔を空けて使うこと。
export async function fetchHtml(watch) {
  const q = watch.query ?? {};
  if (!q.url) throw new Error('query.url が必要です');
  const res = await fetchWithTimeout(q.url);
  const html = await res.text();
  return [parseHtml(html, q)];
}

export function parseHtml(html, q) {
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ');
  const out = q.outOfStock ? new RegExp(q.outOfStock, 'i').test(text) : false;
  const inn = q.inStock ? new RegExp(q.inStock, 'i').test(text) : !out;
  const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(html);

  return {
    id: q.url,
    title: q.title || titleMatch?.[1]?.trim() || q.url,
    variant: null,
    price: null,
    currency: null,
    available: inn && !out,
    url: q.url,
    affiliateUrl: q.affiliateUrl ?? null,
    image: null,
    shop: new URL(q.url).hostname,
  };
}
