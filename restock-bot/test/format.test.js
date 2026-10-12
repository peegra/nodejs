import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatEvent, buildLink } from '../src/notify/format.js';

const watch = { id: 'w', category: 'soccer', label: { ja: '日本代表', en: 'Japan NT' } };
const item = { id: 'a', title: 'ユニ', variant: 'L', price: 15000, url: 'https://shop.jp/a',
  affiliateUrl: 'https://aff/a', shop: 'shop.jp' };

test('日本向けはアフィリエイトリンクとPR表記', () => {
  const p = formatEvent({ type: 'restock', watch, item }, 'jp', {});
  assert.equal(p.embeds[0].url, 'https://aff/a');
  assert.match(p.embeds[0].footer.text, /^PR/);
  assert.match(p.content, /再入荷/);
});

test('海外向けは代行サービスのリンクとドル換算', () => {
  const env = { proxyUrlTemplate: 'https://proxy/?u={url}', jpyPerUsd: 150 };
  const p = formatEvent({ type: 'new', watch, item }, 'global', env);
  assert.equal(p.embeds[0].url, 'https://proxy/?u=https%3A%2F%2Fshop.jp%2Fa');
  assert.match(p.embeds[0].fields[0].value, /\$100/);
  assert.match(p.content, /NEW DROP.*Japan NT/);
});

test('代行テンプレートがなければ元のURL', () => {
  assert.equal(buildLink(item, 'global', {}), 'https://shop.jp/a');
});
