import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_LEVEL, OBJECTS, getObject, levelOf, levelValue } from '../src/objects.js';
import { WORLD, createBody, remainingPct, step, tryKick, windForce } from '../src/physics.js';

const ball = getObject('ball');

// 中心を蹴った状態で n 回ぶん蹴ったことにする
function kicked(def, n) {
  const b = createBody(def);
  b.kicks = n;
  b.state = 'flying';
  return b;
}

test('ステージはボール・おにぎり・生卵・すいか・スマホの5つ', () => {
  assert.deepEqual(OBJECTS.map((o) => o.id), ['ball', 'onigiri', 'egg', 'watermelon', 'phone']);
});

test('レベルは10回ごとに上がり、Lv6で止まる', () => {
  assert.equal(levelOf(0), 1);
  assert.equal(levelOf(9), 1);
  assert.equal(levelOf(10), 2);
  assert.equal(levelOf(49), 5);
  assert.equal(levelOf(50), MAX_LEVEL);
  assert.equal(levelOf(500), MAX_LEVEL);
});

test('レベルごとの設定はどのモノも Lv1〜Lv6 の6段階ぶんある', () => {
  for (const def of OBJECTS) {
    for (const [key, values] of Object.entries(def.levels ?? {})) {
      assert.equal(values.length, MAX_LEVEL, `${def.id}.${key}`);
    }
  }
});

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
  for (let i = 0; i < 60; i++) step(b, ball, 1 / 120, { windNoise: () => 0.5 });
  assert.ok(b.x - b.r >= 0);
  assert.ok(b.vx > 0);
});

test('ボール: Lv1は無風、レベルが上がるほど横風が強くなる', () => {
  const gust = () => 1; // 右向きに最大
  assert.equal(windForce(kicked(ball, 5), ball, gust), 0);
  const forces = [10, 20, 30, 40, 50].map((n) => windForce(kicked(ball, n), ball, gust));
  forces.reduce((prev, f) => (assert.ok(f > prev), f), 0);

  const b = kicked(ball, 30);
  for (let i = 0; i < 60; i++) step(b, ball, 1 / 120, { windNoise: gust });
  assert.ok(b.vx > 0, '右向きの風で右に流される');
});

test('風の設定がないモノは風を受けない', () => {
  const onigiri = getObject('onigiri');
  assert.equal(windForce(kicked(onigiri, 50), onigiri, () => 1), 0);
});

test('生卵: Lv1は判定が緩く、レベルが上がると同じずれでもヒビが入る', () => {
  const egg = getObject('egg');
  const at = (kicks, dx) => {
    const b = kicked(egg, kicks);
    return tryKick(b, egg, b.x + b.r * dx, b.y);
  };
  assert.equal(at(0, 0.6).cracked, false, 'Lv1 では 0.6 ずれてもOK');
  assert.equal(at(50, 0.6).cracked, true, 'Lv6 では 0.6 ずれるとヒビ');
  assert.equal(at(50, 0.3).cracked, false, 'Lv6 でも真ん中ならOK');
});

test('生卵: ヒビ3本までは耐え、4本目で割れる', () => {
  const egg = getObject('egg');
  const b = createBody(egg);
  const kickEdge = () => {
    b.cooldown = 0;
    return tryKick(b, egg, b.x + b.r * 0.9, b.y);
  };
  assert.equal(kickEdge().broke, false);
  assert.equal(kickEdge().broke, false);
  assert.equal(kickEdge().broke, false);
  assert.equal(kickEdge().broke, true);
  assert.equal(b.state, 'broken');
  assert.equal(tryKick(b, egg, b.x, b.y), null);
});

test('おにぎり: 蹴るたびに同じ割合で小さくなり、最小サイズで止まる', () => {
  const onigiri = getObject('onigiri');
  const b = createBody(onigiri);
  tryKick(b, onigiri, b.x, b.y);
  assert.equal(b.r, onigiri.radius * (1 - onigiri.shrinkPerKick));
  for (let i = 0; i < 200; i++) {
    b.cooldown = 0;
    tryKick(b, onigiri, b.x, b.y);
  }
  assert.equal(b.r, onigiri.minRadius);
  assert.equal(remainingPct(b), Math.round((onigiri.minRadius / onigiri.radius) * 100));
});

test('すいか: レベルが上がると、飛んでくる種が増え、垂れるのが遅くなる（長く居座る）', () => {
  const wm = getObject('watermelon');
  assert.equal(levelValue(wm, 'seedsPerKick', 1), 1);
  assert.ok(levelValue(wm, 'seedsPerKick', 5) > levelValue(wm, 'seedsPerKick', 1));
  for (let lv = 2; lv <= MAX_LEVEL; lv++) {
    assert.ok(levelValue(wm, 'seedSlide', lv) < levelValue(wm, 'seedSlide', lv - 1));
  }
});

test('スマホ: レベルが上がると、着信の間隔が短く、覆う範囲が広く濃くなる', () => {
  const phone = getObject('phone');
  for (let lv = 2; lv <= MAX_LEVEL; lv++) {
    assert.ok(levelValue(phone, 'callEvery', lv) < levelValue(phone, 'callEvery', lv - 1));
    assert.ok(levelValue(phone, 'callCover', lv) > levelValue(phone, 'callCover', lv - 1));
    assert.ok(levelValue(phone, 'callOpacity', lv) > levelValue(phone, 'callOpacity', lv - 1));
  }
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
