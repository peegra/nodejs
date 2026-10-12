import { test } from 'node:test';
import assert from 'node:assert/strict';
import { targetFor, dispatch, flushFreeQueue } from '../src/notify/index.js';

const env = (webhooks = {}) => ({
  webhooks: { jp: '', global: '', soccer: '', anime: '', free: '', status: '', ...webhooks },
  freeDelayMin: 30, joinUrl: 'https://join', proxyUrlTemplate: '', jpyPerUsd: 0,
});
const event = (category) => ({
  type: 'restock',
  watch: { id: 'w', category, markets: ['global'], label: { ja: 'x', en: 'x' } },
  item: { id: 'a', title: 'T', price: 1000, url: 'https://shop/a' },
});

test('海外向けはジャンル別のWebhook、なければGLOBALに送る', () => {
  const e = env({ soccer: 'S', global: 'G' });
  assert.equal(targetFor(event('soccer'), 'global', e).url, 'S');
  assert.equal(targetFor(event('anime'), 'global', e).url, 'G');
});

test('無料チャンネルには遅延して届き、申し込みURLが付く', async () => {
  const e = env({ free: 'F' });
  const state = {};
  const logs = [];
  const log = (s) => logs.push(s);
  await dispatch([event('soccer')], e, state, { dryRun: true, log, now: 0 });
  assert.equal(state.freeQueue.length, 1);
  assert.equal(state.freeQueue[0].dueAt, 30 * 60_000);

  assert.equal(await flushFreeQueue(e, state, { dryRun: true, log, now: 29 * 60_000 }), 0);
  assert.equal(await flushFreeQueue(e, state, { dryRun: true, log, now: 30 * 60_000 }), 1);
  assert.equal(state.freeQueue.length, 0);
  assert.match(logs.at(-1), /^\[FREE\]/);
  assert.match(logs.at(-1), /30 min earlier — join: https:\/\/join/);
});

test('無料チャンネル未設定なら遅延配信を予約しない', async () => {
  const state = {};
  await dispatch([event('soccer')], env(), state, { dryRun: true, log: () => {} });
  assert.equal(state.freeQueue, undefined);
});

test('DISCORD_WEBHOOK_<ジャンル> を読み込み、新しいジャンルもそのまま振り分けられる', async () => {
  const { categoryWebhooks } = await import('../src/config.js');
  const hooks = categoryWebhooks({ DISCORD_WEBHOOK_IDOL: 'I', DISCORD_WEBHOOK_SOCCER: '', OTHER: 'x' });
  assert.deepEqual(hooks, { idol: 'I' });
  assert.equal(targetFor(event('idol'), 'global', env(hooks)).url, 'I');
});
