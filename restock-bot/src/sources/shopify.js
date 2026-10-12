import { fetchWithTimeout } from './http.js';

// Shopify のストアは /products.json（一覧）と /products/<handle>.json（単品）を公開している。
// バリエーション（サイズ）単位で在庫が取れるので、サイズ別の再入荷通知ができる。
export async function fetchShopify(watch) {
  const q = watch.query ?? {};
  if (!q.store) throw new Error('query.store（ストアのURL）が必要です');
  const base = q.store.replace(/\/+$/, '');

  let products;
  if (q.handle) {
    const res = await fetchWithTimeout(`${base}/products/${encodeURIComponent(q.handle)}.json`);
    products = [(await res.json()).product];
  } else {
    const res = await fetchWithTimeout(`${base}/products.json?limit=${q.limit ?? 50}`);
    products = (await res.json()).products ?? [];
  }
  return parseShopify(products, base, { keyword: q.keyword, variants: watch.variants });
}

export function parseShopify(products, base, { keyword, variants } = {}) {
  const kw = keyword?.toLowerCase();
  const wantVariant = variants?.length ? new Set(variants.map((v) => v.toLowerCase())) : null;

  return products
    .filter((p) => !kw || p.title?.toLowerCase().includes(kw))
    .flatMap((p) => {
      const url = `${base}/products/${p.handle}`;
      const image = p.images?.[0]?.src ?? p.image?.src ?? null;
      return (p.variants ?? [])
        .filter((v) => !wantVariant || variantNames(v).some((n) => wantVariant.has(n.toLowerCase())))
        .map((v) => ({
          id: `${p.id}:${v.id}`,
          title: p.title,
          variant: v.title === 'Default Title' ? null : v.title,
          price: Number(v.price),
          currency: null,
          available: v.available !== false,
          url: `${url}?variant=${v.id}`,
          affiliateUrl: null,
          image,
          shop: base.replace(/^https?:\/\//, ''),
        }));
    });
}

function variantNames(v) {
  return [v.title, v.option1, v.option2, v.option3].filter(Boolean);
}
