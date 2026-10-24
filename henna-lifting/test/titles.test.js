import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TITLES, addRun, newTitles, rankTitle } from '../src/titles.js';

const baseRun = {
  stage: 'ball', kicks: 0, perfects: 0, bestStreak: 0, broken: false, cracks: 0, walls: 0,
  grains: 0, grainsLost: 0, smallest: false, seeds: 0, calls: 0, callers: [], muted: false, hour: 12, isRecord: false, prevBest: 0,
};
const play = (over, prevTotals) => {
  const run = { ...baseRun, ...over };
  const totals = addRun(prevTotals, run);
  return { run, totals, got: newTitles(run, totals) };
};

test('しょうごうは100こ、id も名前もかぶらない', () => {
  assert.equal(TITLES.length, 100);
  assert.equal(new Set(TITLES.map((t) => t.id)).size, 100);
  assert.equal(new Set(TITLES.map((t) => t.name)).size, 100);
  for (const t of TITLES) assert.ok(t.hint, `${t.id} にヒントがない`);
});

test('結果画面の しょうごうは ステージと回数で5段階', () => {
  assert.equal(rankTitle('ball', 0), 'ボールあそび みならい');
  assert.equal(rankTitle('ball', 15), 'ボールの レギュラー');
  assert.equal(rankTitle('egg', 50), 'でんせつの たまごしょくにん');
  assert.equal(rankTitle('egg', 999), 'でんせつの たまごしょくにん');
});

test('はじめての1回で、みならい と はじめての リフティング が取れる', () => {
  const { got } = play({ stage: 'onigiri', kicks: 3, grains: 1800, grainsLost: 200 });
  assert.ok(got.includes('onigiri-rank-1'));
  assert.ok(got.includes('plays-1'));
  assert.ok(got.includes('exact-3'));
  assert.ok(!got.includes('onigiri-rank-2'));
});

test('ランクは そのステージの回数までの段階を ぜんぶ取れる', () => {
  const { got } = play({ stage: 'egg', kicks: 31, cracks: 1 });
  for (const n of [1, 2, 3, 4]) assert.ok(got.includes(`egg-rank-${n}`));
  assert.ok(!got.includes('egg-rank-5'));
  assert.ok(!got.includes('ball-rank-1'));
});

test('取ったしょうごうは もう一度は出てこない', () => {
  const { run, totals } = play({ kicks: 7 });
  const again = newTitles(run, totals, newTitles(run, totals));
  assert.deepEqual(again, []);
});

test('合計: あそんだ回数・蹴った回数・同じステージの連続が たまっていく', () => {
  let totals = null;
  for (let i = 0; i < 5; i++) totals = play({ stage: 'phone', kicks: 4, calls: 1 }, totals).totals;
  assert.equal(totals.plays, 5);
  assert.equal(totals.kicks, 20);
  assert.equal(totals.sameStageStreak, 5);
  assert.equal(totals.playsBy.phone, 5);
  assert.ok(newTitles({ ...baseRun, stage: 'phone' }, totals).includes('same-5'));
  totals = play({ stage: 'ball' }, totals).totals;
  assert.equal(totals.sameStageStreak, 1);
});

test('生卵を わると めだまやき、10こで たまご 1パック', () => {
  let totals = null;
  let got = [];
  for (let i = 0; i < 10; i++) ({ totals, got } = play({ stage: 'egg', kicks: 8, broken: true, cracks: 4 }, totals));
  assert.equal(totals.eggsBroken, 10);
  assert.ok(got.includes('eggs-10'));
  assert.ok(got.includes('egg-broken'));
});

test('スマホ: でんわの 相手ごとの しょうごう', () => {
  const { got } = play({ stage: 'phone', kicks: 12, calls: 2, callers: ['おばあちゃん', '非通知'] });
  assert.ok(got.includes('caller-おばあちゃん'));
  assert.ok(got.includes('caller-非通知'));
  assert.ok(!got.includes('caller-母'));
});

test('ぜんぶのステージで あそぶと ぜんぶ やってみた', () => {
  let totals = null;
  let got = [];
  for (const stage of ['ball', 'onigiri', 'egg', 'watermelon', 'phone']) ({ totals, got } = play({ stage, kicks: 2 }, totals));
  assert.ok(got.includes('all-played'));
});
