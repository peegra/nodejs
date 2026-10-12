import path from 'node:path';
import { rmSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { ROOT, loadEnv, loadWatches, validateWatch } from './config.js';
import { loadState, saveState } from './state.js';
import { fetchItems } from './sources/index.js';
import { detectChanges } from './detect.js';
import { dispatch } from './notify/index.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { values: args } = parseArgs({
  options: {
    once: { type: 'boolean', default: false },
    demo: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    config: { type: 'string' },
  },
});

export async function runOnce({ watches, env, state, dryRun, round = 0, log = console.log }) {
  let total = 0;
  for (const watch of watches) {
    try {
      const items = await fetchItems(watch, env, { round });
      const { events, next } = detectChanges(watch, state.watches[watch.id], items);
      state.watches[watch.id] = next;
      total += events.length;
      await dispatch(events, env, { dryRun, log });
    } catch (err) {
      // 1件の監視が失敗しても他の監視は続ける
      const cause = err.cause ? ` (${err.cause.code ?? err.cause.message})` : '';
      log(`[error] ${watch.id}: ${err.message}${cause}`);
    }
    if (watch.source !== 'mock') await sleep(1100); // 楽天APIは1秒1回まで
  }
  return total;
}

async function demo() {
  const env = loadEnv();
  const watches = [
    { id: 'demo-soccer', category: 'soccer', source: 'mock', markets: ['jp', 'global'],
      label: { ja: 'サッカー日本代表・Jクラブ 限定ユニ', en: 'Japan NT / J.League limited jerseys' },
      events: ['restock', 'new', 'priceDrop'] },
    { id: 'demo-anime', category: 'anime', source: 'mock', markets: ['jp', 'global'],
      label: { ja: 'アニメ 日本限定グッズ', en: 'Anime Japan-exclusive merch' },
      events: ['restock', 'new'] },
  ];
  watches.forEach(validateWatch);
  env.proxyUrlTemplate ||= 'https://proxy.example/shop?url={url}';
  env.jpyPerUsd ||= 150;

  const stateFile = path.join(ROOT, 'data/demo-state.json');
  rmSync(stateFile, { force: true });
  const state = loadState(stateFile);

  for (let round = 0; round < 3; round++) {
    console.log(`\n===== ${round + 1}回目の監視 ${round === 0 ? '（初回は現状を記録するだけで通知しません）' : ''}=====`);
    const n = await runOnce({ watches, env, state, dryRun: true, round });
    if (n === 0) console.log('(通知なし)');
    saveState(stateFile, state);
  }
}

async function main() {
  if (args.demo) return demo();

  const env = loadEnv();
  const { file, watches } = loadWatches(args.config);
  const stateFile = path.join(ROOT, 'data/state.json');
  const state = loadState(stateFile);
  console.log(`監視設定: ${path.relative(ROOT, file)}（${watches.length}件）`);

  do {
    const n = await runOnce({ watches, env, state, dryRun: args['dry-run'] });
    saveState(stateFile, state);
    console.log(`[${new Date().toLocaleString('ja-JP')}] 監視完了: 通知 ${n} 件`);
    if (args.once) break;
    // 毎回同じ時刻にアクセスしないよう、間隔に±10%の揺らぎを入れる
    await sleep(env.pollIntervalSec * 1000 * (0.9 + Math.random() * 0.2));
  } while (true);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
