import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRakuten } from '../src/sources/rakuten.js';
import { parseShopify } from '../src/sources/shopify.js';
import { parseHtml } from '../src/sources/html.js';

test('楽天: formatVersion 2 の応答を正規化する', () => {
  const [it] = parseRakuten({
    Items: [{ itemCode: 'shop:1', itemName: 'ユニ', itemPrice: 15000, availability: 0,
      itemUrl: 'https://item', affiliateUrl: 'https://aff', mediumImageUrls: ['https://img'], shopName: 'S' }],
  });
  assert.equal(it.id, 'shop:1');
  assert.equal(it.available, false);
  assert.equal(it.affiliateUrl, 'https://aff');
  assert.equal(it.image, 'https://img');
});

test('楽天: formatVersion 1 の応答も読める', () => {
  const [it] = parseRakuten({
    Items: [{ Item: { itemCode: 'x', itemName: 'n', itemPrice: 1, availability: 1, itemUrl: 'u',
      mediumImageUrls: [{ imageUrl: 'https://img' }] } }],
  });
  assert.equal(it.available, true);
  assert.equal(it.image, 'https://img');
});

const products = [
  { id: 1, handle: 'home-jersey', title: '2026 Home ユニフォーム', images: [{ src: 'https://img' }],
    variants: [
      { id: 11, title: 'M', option1: 'M', price: '16500', available: false },
      { id: 12, title: 'L', option1: 'L', price: '16500', available: true },
    ] },
  { id: 2, handle: 'towel', title: 'タオル', variants: [{ id: 21, title: 'Default Title', price: '2000', available: true }] },
];

test('Shopify: サイズ単位で在庫を返す', () => {
  const items = parseShopify(products, 'https://store.jp');
  assert.equal(items.length, 3);
  assert.deepEqual(items.map((i) => [i.variant, i.available]), [['M', false], ['L', true], [null, true]]);
  assert.equal(items[0].url, 'https://store.jp/products/home-jersey?variant=11');
});

test('Shopify: キーワードとサイズで絞り込む', () => {
  const items = parseShopify(products, 'https://store.jp', { keyword: 'ユニフォーム', variants: ['l'] });
  assert.deepEqual(items.map((i) => i.id), ['1:12']);
});

test('HTML: 在庫切れの文言があれば在庫なし', () => {
  const q = { url: 'https://shop.jp/p/1', inStock: 'カートに入れる', outOfStock: '在庫切れ|SOLD OUT' };
  assert.equal(parseHtml('<title>T</title><p>SOLD OUT</p>', q).available, false);
  assert.equal(parseHtml('<title>T</title><button>カートに入れる</button>', q).available, true);
  assert.equal(parseHtml('<script>"在庫切れ"</script><button>カートに入れる</button>', q).available, true);
});
