import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT, loadEnv } from '../config.js';
import { deliver } from '../notify/index.js';
import { evaluate, rank } from './costs.js';
import { fetchJustTcg } from './providers/justtcg.js';
import { fetchMockPrice } from './providers/mock.js';
import { formatReport, renderTable } from './format.js';

// 日本の定価で買って海外の相場で売った場合の見積もり利益を計算し、Discord に投稿する。
//   npm run tcg -- --demo      デモデータで表示だけ
//   npm run tcg -- --dry-run   本物の相場で計算し、表示だけ
//   npm run tcg                本物の相場で計算し、DISCORD_WEBHOOK_TCG（なければ GLOBAL）に投稿

const PROVIDERS = { justtcg: fetchJustTcg, mock: fetchMockPrice };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function validateProduct(p) {
  const where = `product "${p.id ?? '(idなし)'}"`;
  if (!p.id) throw new Error(`${where}: id が必要です`);
  if (!p.name?.ja || !p.name?.en) throw new Error(`${where}: name.ja と name.en が必要です`);
  if (!(p.msrpJpy > 0)) throw new Error(`${where}: msrpJpy（日本の定価・税込）が必要です`);
  if (!PROVIDERS[p.market?.provider]) {
    throw new Error(`${where}: market.provider は ${Object.keys(PROVIDERS).join(' / ')} から選んでください`);
  }
}

export async function buildReport(products, costs, env, { log = console.log } = {}) {
  const results = [];
  for (const product of products) {
    let market = null;
    try {
      market = await PROVIDERS[product.market.provider](product, env);
    } catch (err) {
      log(`[error] ${product.id}: ${err.message}`);
    }
    results.push(evaluate(product, market, costs));
    if (product.market.provider !== 'mock') await sleep(1000); // APIのレート制限に余裕を持たせる
  }
  return rank(results);
}

function readJson(name) {
  const own = path.join(ROOT, 'config', `${name}.json`);
  const file = existsSync(own) ? own : path.join(ROOT, 'config', `${name}.example.json`);
  return { file, data: JSON.parse(readFileSync(file, 'utf8')) };
}

const DEMO_PRODUCTS = [
  ['demo-pokemon-box-a', 'ポケモンカード 拡張パック A BOX', 'Pokémon TCG JP booster box A', 6000, '2026-09-26'],
  ['demo-pokemon-box-b', 'ポケモンカード 拡張パック B BOX', 'Pokémon TCG JP booster box B', 6000, '2026-07-18'],
  ['demo-pokemon-special-set', 'ポケモンカード スペシャルセット', 'Pokémon TCG JP special set', 5500, '2026-10-24'],
  ['demo-onepiece-box-a', 'ワンピースカード ブースター A BOX', 'One Piece Card Game JP booster box A', 5280, '2026-08-30'],
  ['demo-onepiece-box-b', 'ワンピースカード ブースター B BOX', 'One Piece Card Game JP booster box B', 5280, '2026-06-14'],
  ['demo-upcoming', 'ポケモンカード 次弾 BOX（予約受付中）', 'Pokémon TCG JP next set (pre-order)', 6000, '2026-12-05'],
].map(([id, ja, en, msrpJpy, releaseDate]) => ({ id, name: { ja, en }, msrpJpy, releaseDate, market: { provider: 'mock' } }));

async function main() {
  const { values: args } = parseArgs({
    options: { demo: { type: 'boolean', default: false }, 'dry-run': { type: 'boolean', default: false } },
  });
  const env = loadEnv();
  const { file: costsFile, data: costs } = readJson('tcg-costs');
  const products = args.demo ? DEMO_PRODUCTS : readJson('tcg-products').data;
  products.forEach(validateProduct);
  console.log(`費用の前提: ${path.relative(ROOT, costsFile)}／商品 ${products.length} 件${args.demo ? '（デモ）' : ''}`);

  const results = await buildReport(products, costs, env);
  console.log(`\n${renderTable(results)}\n`);

  const target = { name: 'tcg', url: env.webhooks.tcg || env.webhooks.global };
  await deliver(target, formatReport(results, costs), { dryRun: args.demo || args['dry-run'] });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
