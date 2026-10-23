import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OBJECTS, getObject } from '../src/objects.js';
import { WORLD, createBody, remainingPct, step, tryKick } from '../src/physics.js';

const ball = getObject('ball');

test('最初のタップまでは落ちてこない', () => {
  const b = createBody(ball);
  const y = b.y;
  for (let i = 0; i < 120; i++) step(b, ball, 1 / 120);
  assert.equal(b.y, y);
  assert.equal(b.state, 'ready');
});

test('真ん中を蹴るとまっすぐ上へ、左側を蹴ると右へ、右側を蹴ると左へ飛ぶ', () => {
  const center = createBody(ball);
  const r = tryKick(center, ball, center.x, center.y);
  assert.ok(r.perfect);
  assert.equal(center.vx, -0);
  assert.equal(center.vy, -ball.kickSpeed);
  assert.equal(center.state, 'flying');

  const left = createBody(ball);
  tryKick(left, ball, left.x - left.r * 0.8, left.y);
  assert.ok(left.vx > 0);

  const right = createBody(ball);
  tryKick(right, ball, right.x + right.r * 0.8, right.y);
  assert.ok(right.vx < 0);
});

test('モノから離れた場所のタップは空振り', () => {
  const b = createBody(ball);
  assert.equal(tryKick(b, ball, b.x + b.r * 2, b.y), null);
  assert.equal(b.kicks, 0);
});

test('連打しても一定時間は蹴れない', () => {
  const b = createBody(ball);
  assert.ok(tryKick(b, ball, b.x, b.y));
  assert.equal(tryKick(b, ball, b.x, b.y), null);
  for (let i = 0; i < 20; i++) step(b, ball, 1 / 120);
  assert.ok(tryKick(b, ball, b.x, b.y));
  assert.equal(b.kicks, 2);
});

test('蹴らなければ地面に落ちて終わる', () => {
  const b = createBody(ball);
  tryKick(b, ball, b.x, b.y);
  for (let i = 0; i < 600 && b.state === 'flying'; i++) step(b, ball, 1 / 120);
  assert.equal(b.state, 'grounded');
  assert.equal(b.y + b.r, WORLD.ground);
});

test('壁に当たると跳ね返る', () => {
  const b = createBody(ball, { x: 60 });
  tryKick(b, ball, b.x + b.r, b.y); // 右側を蹴って左の壁へ
  for (let i = 0; i < 60; i++) step(b, ball, 1 / 120);
  assert.ok(b.x - b.r >= 0);
  assert.ok(b.vx > 0);
});

test('生卵: 真ん中なら割れず、端を3回蹴ると割れる', () => {
  const egg = getObject('egg');
  const b = createBody(egg);
  const kickAt = (dx) => {
    b.cooldown = 0;
    return tryKick(b, egg, b.x + b.r * dx, b.y);
  };
  assert.equal(kickAt(0.1).cracked, false);
  assert.equal(kickAt(0.8).cracked, true);
  assert.equal(kickAt(-0.8).broke, false);
  const last = kickAt(0.9);
  assert.equal(last.broke, true);
  assert.equal(b.state, 'broken');
  assert.equal(tryKick(b, egg, b.x, b.y), null);
});

test('おにぎり: 蹴るたびに小さくなり、最小サイズで止まる', () => {
  const onigiri = getObject('onigiri');
  const b = createBody(onigiri);
  for (let i = 0; i < 200; i++) {
    b.cooldown = 0;
    b.state = 'flying';
    tryKick(b, onigiri, b.x, b.y);
  }
  assert.equal(b.r, onigiri.minRadius);
  assert.equal(remainingPct(b), Math.round((onigiri.minRadius / onigiri.radius) * 100));
});

test('豆腐: 端を蹴ると一発で崩れる', () => {
  const tofu = getObject('tofu');
  const b = createBody(tofu);
  assert.equal(tryKick(b, tofu, b.x + b.r * 0.9, b.y).broke, true);
});

test('スマホ: 蹴るたびにヒビが増えるが、それでは終わらない', () => {
  const phone = getObject('phone');
  const b = createBody(phone);
  for (let i = 0; i < 5; i++) {
    b.cooldown = 0;
    tryKick(b, phone, b.x + b.r * 0.9, b.y);
  }
  assert.equal(b.cracks, 5);
  assert.equal(b.state, 'flying');
});

test('風船: 風で横に流される', () => {
  const balloon = getObject('balloon');
  const b = createBody(balloon);
  tryKick(b, balloon, b.x, b.y);
  for (let i = 0; i < 60; i++) step(b, balloon, 1 / 120, { windNoise: () => 1 });
  assert.ok(b.vx > 0);
});

test('どのモノも、真ん中を蹴れば地面より上まで上がる（遊べる数値になっている）', () => {
  for (const def of OBJECTS) {
    const b = createBody(def);
    tryKick(b, def, b.x, b.y);
    let top = b.y;
    for (let i = 0; i < 400 && b.state === 'flying'; i++) {
      step(b, def, 1 / 120, { windNoise: () => 0.5 });
      top = Math.min(top, b.y);
    }
    assert.ok(createBody(def).y - top > 80, `${def.id} の上がり幅が小さすぎる`);
  }
});
