import { test } from 'node:test';
import assert from 'node:assert/strict';
import { updateHealth } from '../src/health.js';

const watch = { id: 'shop' };

test('3回続けて失敗したら1度だけ知らせ、復旧したら知らせる', () => {
  const state = {};
  assert.equal(updateHealth(state, watch, { error: 'HTTP 500' }), null);
  assert.equal(updateHealth(state, watch, { error: 'HTTP 500' }), null);
  assert.match(updateHealth(state, watch, { error: 'HTTP 500' }), /3回続けて失敗/);
  assert.equal(updateHealth(state, watch, { error: 'HTTP 500' }), null);
  assert.match(updateHealth(state, watch, { itemCount: 2 }), /復旧/);
  assert.equal(updateHealth(state, watch, { itemCount: 2 }), null);
});

test('0件も失敗として数える', () => {
  const state = {};
  updateHealth(state, watch, { itemCount: 0 }, { threshold: 2 });
  assert.match(updateHealth(state, watch, { itemCount: 0 }, { threshold: 2 }), /0件/);
});

test('途中で成功したら回数はリセットされる', () => {
  const state = {};
  updateHealth(state, watch, { error: 'x' });
  updateHealth(state, watch, { error: 'x' });
  updateHealth(state, watch, { itemCount: 1 });
  assert.equal(updateHealth(state, watch, { error: 'x' }), null);
  assert.equal(state.health.shop.failures, 1);
});
