// 描画やブラウザに依存しない、物理と判定だけのモジュール（テストしやすくするため分けている）。
import { levelOf, levelValue } from './objects.js';

export const WORLD = { width: 400, height: 700, ground: 640 };

const WALL_BOUNCE = 0.7;
const KICK_COOLDOWN = 0.12; // 秒。連打で張り付くのを防ぐ
const HIT_SLOP = 1.35; // 見た目より少し大きめに当たり判定を取る
const SIDE_SPEED = 520; // 端を蹴ったときの横方向の速さ

export function createBody(def, { x = WORLD.width / 2, y = WORLD.ground - 260 } = {}) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    angle: 0,
    spin: 0,
    r: def.radius,
    r0: def.radius,
    cracks: 0,
    kicks: 0,
    cooldown: 0,
    time: 0,
    state: 'ready', // ready（最初のタップ待ち）| flying | grounded | broken
  };
}

// 今の横風の力（プラスで右向き）。レベルが上がるほど強い。windNoise は 0〜1 の値を返す関数
export function windForce(body, def, windNoise = defaultWind) {
  const strength = levelValue(def, 'wind', levelOf(body.kicks));
  return strength ? (windNoise(body.time) * 2 - 1) * strength : 0;
}

// dt 秒ぶん進める。windNoise はテストで差し替えられるように引数にしている
export function step(body, def, dt, { windNoise = defaultWind } = {}) {
  if (body.state !== 'flying') return body;
  body.time += dt;
  body.cooldown = Math.max(0, body.cooldown - dt);

  body.vy += def.gravity * dt;
  body.vx += windForce(body, def, windNoise) * dt;
  const damp = Math.max(0, 1 - def.drag * dt);
  body.vx *= damp;
  body.vy *= damp;

  body.x += body.vx * dt;
  body.y += body.vy * dt;
  body.angle += body.spin * dt;
  body.spin *= Math.max(0, 1 - 0.8 * dt);

  if (body.x - body.r < 0) {
    body.x = body.r;
    body.vx = Math.abs(body.vx) * WALL_BOUNCE;
  } else if (body.x + body.r > WORLD.width) {
    body.x = WORLD.width - body.r;
    body.vx = -Math.abs(body.vx) * WALL_BOUNCE;
  }

  if (body.y + body.r >= WORLD.ground) {
    body.y = WORLD.ground - body.r;
    body.state = 'grounded';
  }
  return body;
}

// タップした位置で蹴る。当たらなければ null、当たれば結果を返す。
//   offset: モノの中心から横にどれだけずれた位置を蹴ったか（-1.35〜1.35、0が真ん中）
export function tryKick(body, def, tapX, tapY) {
  if ((body.state !== 'ready' && body.state !== 'flying') || body.cooldown > 0) return null;
  const dx = tapX - body.x;
  const dy = tapY - body.y;
  if (Math.hypot(dx, dy) > body.r * HIT_SLOP) return null;

  const offset = clamp(dx / body.r, -HIT_SLOP, HIT_SLOP);
  const level = levelOf(body.kicks); // 蹴る前の回数でレベルを決める
  // 左側を蹴ると右へ、右側を蹴ると左へ飛ぶ
  body.vx = -offset * SIDE_SPEED;
  body.vy = -def.kickSpeed;
  body.spin = -offset * 9;
  body.cooldown = KICK_COOLDOWN;
  body.kicks += 1;
  body.state = 'flying';

  const result = { offset, perfect: Math.abs(offset) < 0.2, cracked: false, broke: false, shrank: false };

  const threshold = def.fragile ? levelValue(def, 'crackThreshold', level, def.fragile.threshold) : 0;
  if (def.fragile && Math.abs(offset) > threshold) {
    body.cracks += 1;
    result.cracked = true;
    if (body.cracks > def.fragile.maxCracks) {
      body.state = 'broken';
      result.broke = true;
    }
  } else if (def.cracksOnKick) {
    body.cracks += 1;
    result.cracked = true;
  }

  if (def.shrinkPerKick && !result.broke) {
    const next = Math.max(def.minRadius, body.r * (1 - def.shrinkPerKick));
    result.shrank = next < body.r;
    body.r = next;
  }
  return result;
}

// 結果画面に出す「おまけの数字」（米粒の残りなど）
export function remainingPct(body) {
  return Math.round((body.r / body.r0) * 100);
}

// 1つの向きに7秒ほど吹き続け、その中で強弱（突風）が付く
function defaultWind(t) {
  return 0.5 + 0.4 * Math.sin(t * 0.45) + 0.1 * Math.sin(t * 2.3 + 1);
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}
