import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectChanges } from '../src/detect.js';

const watch = { id: 'w', events: ['restock', 'new', 'priceDrop'] };
const item = (id, available, price = 1000) => ({ id, title: id, available, price });

test('初回は記録だけで通知しない', () => {
  const { events, next } = detectChanges(watch, undefined, [item('a', true)]);
  assert.equal(events.length, 0);
  assert.equal(next.seeded, true);
});

test('在庫なし → ありで restock', () => {
  const { next } = detectChanges(watch, undefined, [item('a', false)]);
  const { events } = detectChanges(watch, next, [item('a', true)]);
  assert.deepEqual(events.map((e) => e.type), ['restock']);
});

test('在庫あり → ありは通知しない', () => {
  const { next } = detectChanges(watch, undefined, [item('a', true)]);
  assert.equal(detectChanges(watch, next, [item('a', true)]).events.length, 0);
});

test('2回目以降に出てきた在庫ありの商品は new、在庫なしなら通知しない', () => {
  const { next } = detectChanges(watch, undefined, [item('a', true)]);
  const { events } = detectChanges(watch, next, [item('a', true), item('b', true), item('c', false)]);
  assert.deepEqual(events.map((e) => [e.type, e.item.id]), [['new', 'b']]);
});

test('10%以上の値下がりで priceDrop', () => {
  const { next } = detectChanges(watch, undefined, [item('a', true, 1000)]);
  assert.equal(detectChanges(watch, next, [item('a', true, 950)]).events.length, 0);
  const { events } = detectChanges(watch, next, [item('a', true, 900)]);
  assert.equal(events[0].type, 'priceDrop');
  assert.equal(events[0].previousPrice, 1000);
});

test('events に含まれない種類は通知しない', () => {
  const w = { id: 'w', events: ['new'] };
  const { next } = detectChanges(w, undefined, [item('a', false)]);
  assert.equal(detectChanges(w, next, [item('a', true)]).events.length, 0);
});

test('今回の取得に出てこなかった商品の状態は残す', () => {
  const { next } = detectChanges(watch, undefined, [item('a', false), item('b', true)]);
  const r2 = detectChanges(watch, next, [item('b', true)]);
  assert.equal(r2.next.items.a.available, false);
  const r3 = detectChanges(watch, r2.next, [item('a', true)]);
  assert.deepEqual(r3.events.map((e) => e.type), ['restock']);
});
