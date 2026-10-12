import { test } from 'node:test';
import assert from 'node:assert/strict';
import { landedCost, evaluate, rank } from '../src/tcg/costs.js';
import { pickVariant, fetchJustTcg } from '../src/tcg/providers/justtcg.js';
import { formatReport } from '../src/tcg/format.js';
import { validateProduct, buildReport } from '../src/tcg/index.js';

const costs = {
  jpyPerUsd: 150, unitsPerOrder: 3, proxyFeeJpy: 1000, domesticShippingJpy: 800,
  paymentFeePct: 3.5, intlShippingUsdPerUnit: 9, dutyPct: 0, sellingFeePct: 13,
};
const product = { id: 'box', name: { ja: 'BOX', en: 'Box' }, msrpJpy: 6000, market: { provider: 'mock' } };
const close = (a, b) => assert.ok(Math.abs(a - b) < 0.01, `${a} ≈ ${b}`);

test('着地コスト: 代行・国内送料は1注文の個数で割り、決済手数料と国際送料を足す', () => {
  const c = landedCost(product, costs);
  close(c.usd.goods, 44); // (6000 + 1800/3) / 150
  close(c.usd.paymentFee, 1.54);
  close(c.totalUsd, 54.54);
});

test('関税は商品代金に対してかかる', () => {
  close(landedCost(product, { ...costs, dutyPct: 10 }).usd.duty, 4); // 6000/150 * 10%
});

test('見積もり利益は販売手数料を引いた手取りから着地コストを引く', () => {
  const r = evaluate(product, { priceUsd: 89 }, costs);
  close(r.netUsd, 77.43);
  close(r.profitUsd, 22.89);
  close(r.marginPct, 41.97);
});

test('相場がない商品は利益なしで最後に並ぶ', () => {
  const sorted = rank([
    evaluate(product, null, costs),
    evaluate(product, { priceUsd: 50 }, costs),
    evaluate(product, { priceUsd: 100 }, costs),
  ]);
  assert.deepEqual(sorted.map((r) => r.market?.priceUsd ?? null), [100, 50, null]);
});

const card = {
  name: 'Box', variants: [
    { condition: 'Sealed', language: 'English', printing: 'Normal', price: 150, lastUpdated: 200 },
    { condition: 'Sealed', language: 'Japanese', printing: 'Normal', price: 80, priceChange7d: 5, lastUpdated: 100 },
    { condition: 'Sealed', language: 'Japanese', printing: 'Normal', price: null, lastUpdated: 300 },
  ],
};

test('JustTCG: 条件に合い価格のあるバリエーションを選ぶ', () => {
  const p = pickVariant(card, { condition: 'sealed', language: 'Japanese' });
  assert.equal(p.priceUsd, 80);
  assert.equal(p.change7dPct, 5);
  assert.equal(pickVariant(card, { language: 'Korean' }), null);
  assert.equal(pickVariant(undefined), null);
});

test('JustTCG: APIキーとカードIDを付けて問い合わせる', async (t) => {
  let called;
  t.mock.method(globalThis, 'fetch', async (url, opts) => {
    called = { url: String(url), key: opts.headers['x-api-key'] };
    return new Response(JSON.stringify({ data: [card] }), { status: 200 });
  });
  const p = await fetchJustTcg({ id: 'x', market: { cardId: 'abc', language: 'Japanese' } }, { justtcgApiKey: 'K' });
  assert.equal(called.key, 'K');
  assert.match(called.url, /^https:\/\/api\.justtcg\.com\/v1\/cards\?cardId=abc&language=Japanese$/);
  assert.equal(p.priceUsd, 80);
  await assert.rejects(fetchJustTcg({ id: 'x', market: { cardId: 'abc' } }, {}), /JUSTTCG_API_KEY/);
});

test('取得に失敗した商品も一覧に残る（相場なし扱い）', async () => {
  const logs = [];
  const broken = { ...product, id: 'broken', market: { provider: 'justtcg', cardId: 'x' } };
  const results = await buildReport([broken], costs, {}, { log: (s) => logs.push(s) });
  assert.equal(results[0].profitUsd, null);
  assert.match(logs[0], /broken: JUSTTCG_API_KEY/);
});

test('レポート: 利益の正負と相場なしが区別され、免責文が付く', () => {
  const results = rank([
    evaluate({ ...product, name: { ja: 'a', en: 'Up' } }, { priceUsd: 89, change7dPct: 6.2 }, costs),
    evaluate({ ...product, name: { ja: 'b', en: 'Down' } }, { priceUsd: 52 }, costs),
    evaluate({ ...product, name: { ja: 'c', en: 'Next' } }, null, costs),
  ]);
  const { embeds: [e] } = formatReport(results, costs);
  assert.deepEqual(e.fields.map((f) => [...f.name][0]), ['🟢', '🔴', '⏳']);
  assert.match(e.fields[0].value, /\+\$22\.89 \(\+42%\)/);
  assert.match(e.fields[1].value, /−\$9\.30/);
  assert.match(e.fields[2].value, /No US market price yet/);
  assert.match(e.footer.text, /Not financial advice/);
});

test('レポート: 古い相場には警告を付ける', () => {
  const old = new Date(Date.now() - 10 * 86_400_000).toISOString();
  const r = evaluate(product, { priceUsd: 89, lastUpdated: old }, costs);
  assert.match(formatReport([r], costs).embeds[0].fields[0].value, /price data is old/);
});

test('商品設定の検証', () => {
  assert.doesNotThrow(() => validateProduct(product));
  assert.throws(() => validateProduct({ ...product, msrpJpy: 0 }), /msrpJpy/);
  assert.throws(() => validateProduct({ ...product, market: { provider: 'ebay' } }), /provider/);
});
