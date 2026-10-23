import { OBJECTS, getObject } from './objects.js';
import { WORLD, createBody, remainingPct, step, tryKick } from './physics.js';

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);

const STEP = 1 / 120;
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const DISPLAY_FONT = '"Dela Gothic One","Hiragino Sans",system-ui,sans-serif';
const BODY_FONT = '"Zen Maru Gothic","Hiragino Maru Gothic ProN",system-ui,sans-serif';

const store = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(`henna-lifting:${key}`)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`henna-lifting:${key}`, JSON.stringify(value));
    } catch {
      // プライベートブラウズなどで保存できなくても遊べるようにする
    }
  },
};

const state = {
  screen: 'menu', // menu | play | over
  def: null,
  body: null,
  particles: [],
  popups: [],
  feet: [],
  notice: null,
  nextNoticeAt: 0,
  overTimer: 0,
  shake: 0,
  best: store.get('best', {}),
  muted: store.get('muted', false),
  view: { scale: 1, ox: 0, oy: 0 },
};

// ---------- 音（Web Audio で簡単な効果音を合成する） ----------
let audio = null;
function ensureAudio() {
  if (!audio) {
    try {
      audio = new AudioContext();
    } catch {
      audio = null;
    }
  }
  if (audio?.state === 'suspended') audio.resume();
}
function tone(freq, dur = 0.08, type = 'triangle', gain = 0.25, slideTo) {
  if (state.muted || !audio) return;
  const t = audio.currentTime;
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g).connect(audio.destination);
  osc.start(t);
  osc.stop(t + dur);
}
function noise(dur = 0.2, gain = 0.3) {
  if (state.muted || !audio) return;
  const buf = audio.createBuffer(1, Math.floor(audio.sampleRate * dur), audio.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = audio.createBufferSource();
  const g = audio.createGain();
  g.gain.value = gain;
  src.buffer = buf;
  src.connect(g).connect(audio.destination);
  src.start();
}
const KICK_PITCH = { ball: 520, onigiri: 440, egg: 760, balloon: 980, watermelon: 170, phone: 620, tofu: 360 };

// ---------- 画面サイズ ----------
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const scale = Math.min(w / WORLD.width, h / WORLD.height);
  state.view = { scale: scale * dpr, ox: ((w - WORLD.width * scale) / 2) * dpr, oy: ((h - WORLD.height * scale) / 2) * dpr };
}
window.addEventListener('resize', resize);
resize();

function toWorld(clientX, clientY) {
  const dpr = window.devicePixelRatio || 1;
  const { scale, ox, oy } = state.view;
  return { x: (clientX * dpr - ox) / scale, y: (clientY * dpr - oy) / scale };
}

// ---------- 画面遷移 ----------
function showMenu() {
  state.screen = 'menu';
  $('result').hidden = true;
  $('menu').hidden = false;
  const list = $('object-list');
  list.innerHTML = '';
  for (const def of OBJECTS) {
    const btn = document.createElement('button');
    btn.className = 'object-btn';
    btn.innerHTML = `<span class="object-icon">${def.emoji || '<span class="tofu-icon"></span>'}</span>
      <span class="object-text"><strong>${def.name}</strong><small>${def.intro}</small></span>
      <span class="object-best">${state.best[def.id] ? `最高 ${state.best[def.id]}回` : ''}</span>`;
    btn.addEventListener('click', () => startGame(def.id));
    list.appendChild(btn);
  }
}

function startGame(id) {
  ensureAudio();
  state.def = getObject(id);
  state.body = createBody(state.def);
  state.particles = [];
  state.popups = [];
  state.feet = [];
  state.notice = null;
  state.nextNoticeAt = 2.5;
  state.overTimer = 0;
  state.shake = 0;
  state.screen = 'play';
  $('menu').hidden = true;
  $('result').hidden = true;
}

function endGame() {
  state.screen = 'over';
  const { def, body } = state;
  const score = body.kicks;
  const isRecord = score > (state.best[def.id] ?? 0);
  if (isRecord) {
    state.best[def.id] = score;
    store.set('best', state.best);
  }
  $('result-title').textContent = `${def.name}リフティング`;
  $('result-score').textContent = `${score}回`;
  $('result-extra').textContent = extraLine(def, body);
  $('result-line').textContent = body.state === 'broken' ? def.breakLine : def.groundLine;
  $('result-record').hidden = !isRecord || score === 0;
  updateShareLink();
  $('result').hidden = false;
}

function extraLine(def, body) {
  if (def.id === 'onigiri') return `米粒の残り ${remainingPct(body)}%`;
  if (def.id === 'tofu') return `豆腐の残り ${remainingPct(body)}%`;
  if (def.id === 'egg') return `ヒビ ${body.cracks}本`;
  if (def.id === 'phone') return `画面のヒビ ${body.cracks}本`;
  return state.best[def.id] ? `自己ベスト ${state.best[def.id]}回` : '';
}

function shareText() {
  const { def, body } = state;
  const extra = extraLine(def, body);
  return `変なものリフティングで「${def.name}」を${body.kicks}回蹴り上げた！${extra ? `（${extra}）` : ''} #変なものリフティング`;
}

// X の投稿画面へのリンク（スマホの共有メニューが使えない環境でも動くように、普通のリンクにしている）
function updateShareLink() {
  const url = location.href.split('#')[0];
  $('share').href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText())}&url=${encodeURIComponent(url)}`;
}

async function copyResult() {
  const text = `${shareText()} ${location.href.split('#')[0]}`;
  try {
    await navigator.clipboard.writeText(text);
    $('copy').textContent = 'コピーしました';
  } catch {
    $('copy').textContent = 'コピーできませんでした';
  }
  setTimeout(() => ($('copy').textContent = '結果をコピー'), 1600);
}

$('retry').addEventListener('click', () => startGame(state.def.id));
$('change').addEventListener('click', showMenu);
$('copy').addEventListener('click', copyResult);
$('mute').addEventListener('click', () => {
  state.muted = !state.muted;
  store.set('muted', state.muted);
  $('mute').textContent = state.muted ? '🔇' : '🔊';
});
$('mute').textContent = state.muted ? '🔇' : '🔊';

// ---------- 入力 ----------
canvas.addEventListener('pointerdown', (e) => {
  if (state.screen !== 'play') return;
  ensureAudio();
  const p = toWorld(e.clientX, e.clientY);
  const { def, body } = state;
  const result = tryKick(body, def, p.x, p.y);
  if (!result) return;

  state.feet.push({ x: p.x, y: p.y + body.r * 0.6, life: 0.18, flip: result.offset > 0 });
  tone(KICK_PITCH[def.id] ?? 500, def.id === 'watermelon' ? 0.12 : 0.07, def.id === 'balloon' ? 'sine' : 'triangle');

  if (result.perfect) addPopup('Perfect!', body.x, body.y - body.r - 10, '#ffd43b');
  if (result.shrank) burst(body.x, body.y, def.id === 'onigiri' ? '#ffffff' : '#f8f4e3', 7, 2.5);
  if (result.cracked && def.fragile) {
    noise(0.08, 0.2);
    addPopup('ピキッ', body.x + body.r, body.y - body.r, '#ff8787');
  }
  if (result.broke) {
    noise(0.3, 0.35);
    burst(body.x, body.y, def.id === 'egg' ? '#ffd43b' : '#f8f4e3', 24, 4);
    state.shake = 0.3;
  }
});

// ---------- 演出 ----------
function addPopup(text, x, y, color) {
  state.popups.push({ text, x, y, color, life: 0.7 });
}

function burst(x, y, color, count, size) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 120 + Math.random() * 260;
    state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 150, life: 0.9, color, size: size * (0.6 + Math.random()) });
  }
}

function landingEffect() {
  const { def, body } = state;
  state.shake = def.id === 'watermelon' ? 0.35 : 0.15;
  const colors = { egg: '#ffd43b', watermelon: '#e03131', phone: '#adb5bd', onigiri: '#ffffff', tofu: '#f8f4e3' };
  if (colors[def.id]) burst(body.x, WORLD.ground - 4, colors[def.id], def.id === 'watermelon' ? 30 : 16, 4);
  if (def.id === 'egg' || def.id === 'watermelon') noise(0.35, 0.35);
  else tone(220, 0.25, 'sine', 0.2, 90);
}

// ---------- 更新 ----------
function update(dt) {
  const { def, body } = state;
  if (state.screen === 'play' || state.screen === 'over') {
    const wasFlying = body.state === 'flying';
    step(body, def, dt);
    if (state.screen === 'play' && wasFlying && body.state === 'grounded') landingEffect();
    if (state.screen === 'play' && (body.state === 'grounded' || body.state === 'broken')) {
      state.overTimer += dt;
      if (state.overTimer > 0.8) endGame();
    }

    if (def.notifications && state.screen === 'play' && body.state === 'flying') {
      state.nextNoticeAt -= dt;
      if (state.nextNoticeAt <= 0) {
        const msgs = def.notifications;
        state.notice = { text: msgs[Math.floor(Math.random() * msgs.length)], life: 1.8 };
        state.nextNoticeAt = 2.5 + Math.random() * 3;
        tone(1320, 0.06, 'sine', 0.15);
      }
    }
  }

  for (const p of state.particles) {
    p.vy += 900 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.y > WORLD.ground) {
      p.y = WORLD.ground;
      p.vx *= 0.5;
      p.vy *= -0.2;
    }
    p.life -= dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
  for (const p of state.popups) {
    p.y -= 40 * dt;
    p.life -= dt;
  }
  state.popups = state.popups.filter((p) => p.life > 0);
  for (const f of state.feet) f.life -= dt;
  state.feet = state.feet.filter((f) => f.life > 0);
  if (state.notice) {
    state.notice.life -= dt;
    if (state.notice.life <= 0) state.notice = null;
  }
  state.shake = Math.max(0, state.shake - dt);
}

// ---------- 描画 ----------
function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD.ground);
  sky.addColorStop(0, '#74c0fc');
  sky.addColorStop(1, '#d0ebff');
  ctx.fillStyle = sky;
  ctx.fillRect(-200, -400, WORLD.width + 400, WORLD.ground + 400);

  // 遠くのゴール
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 4;
  ctx.strokeRect(110, WORLD.ground - 90, 180, 90);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  for (let x = 120; x < 290; x += 12) {
    ctx.beginPath();
    ctx.moveTo(x, WORLD.ground - 88);
    ctx.lineTo(x, WORLD.ground);
    ctx.stroke();
  }

  // 芝生（しま模様）
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? '#51cf66' : '#40c057';
    ctx.fillRect(-200 + i * 100, WORLD.ground, 100, WORLD.height - WORLD.ground + 400);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(-200, WORLD.ground, WORLD.width + 400, 3);
}

function drawCracks(body, count, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let i = 0; i < Math.min(count, 12); i++) {
    // ヒビの形はヒビの番号から毎回同じように決める
    const a = (i * 2.4) % (Math.PI * 2);
    let x = Math.cos(a) * body.r * 0.15;
    let y = Math.sin(a) * body.r * 0.15;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 1; k <= 3; k++) {
      x += Math.cos(a + (k % 2 ? 0.6 : -0.6)) * body.r * 0.22;
      y += Math.sin(a + (k % 2 ? 0.6 : -0.6)) * body.r * 0.22;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function drawObject() {
  const { def, body } = state;
  if (body.state === 'broken') return;
  const squash = body.state === 'grounded' ? 0.75 : 1;

  // 影
  const h = Math.max(0, WORLD.ground - (body.y + body.r));
  ctx.fillStyle = `rgba(0,0,0,${Math.max(0.05, 0.25 - h / 1500)})`;
  ctx.beginPath();
  ctx.ellipse(body.x, WORLD.ground + 4, body.r * (1 - Math.min(h, 500) / 900), body.r * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(body.x, body.y + (1 - squash) * body.r);
  ctx.rotate(body.angle);
  ctx.scale(1 / squash, squash);
  if (def.emoji) {
    ctx.font = `${body.r * 2.1}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000'; // 絵文字も fillStyle の透明度の影響を受けるので不透明にしておく
    ctx.fillText(def.emoji, 0, body.r * 0.08);
  } else {
    // 豆腐（絵文字がないので描く）
    const s = body.r * 1.6;
    ctx.fillStyle = '#fffdf5';
    ctx.strokeStyle = '#e9e3cf';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-s / 2, -s / 2, s, s, body.r * 0.18);
    ctx.fill();
    ctx.stroke();
  }
  if (body.cracks && def.id !== 'tofu') drawCracks(body, body.cracks, def.id === 'phone' ? 'rgba(255,255,255,0.9)' : 'rgba(80,50,20,0.8)');
  ctx.restore();

  // 画面より上に飛んだときの目印
  if (body.y + body.r < 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.moveTo(body.x, 6);
    ctx.lineTo(body.x - 12, 26);
    ctx.lineTo(body.x + 12, 26);
    ctx.fill();
  }
}

function drawEffects() {
  for (const p of state.particles) {
    ctx.globalAlpha = Math.min(1, p.life * 2);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.size, p.size * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const f of state.feet) {
    ctx.save();
    ctx.globalAlpha = f.life / 0.18;
    ctx.translate(f.x, f.y);
    ctx.scale(f.flip ? -1 : 1, 1);
    ctx.rotate(-0.5 + (1 - f.life / 0.18) * 0.6);
    ctx.font = `44px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000';
    ctx.fillText('👟', 0, 0);
    ctx.restore();
  }

  ctx.textAlign = 'center';
  for (const p of state.popups) {
    ctx.globalAlpha = Math.min(1, p.life * 2);
    ctx.font = `22px ${DISPLAY_FONT}`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.strokeText(p.text, p.x, p.y);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}

function drawHud() {
  const { def, body } = state;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 6;
  ctx.font = `72px ${DISPLAY_FONT}`;
  ctx.strokeText(String(body.kicks), WORLD.width / 2, 120);
  ctx.fillText(String(body.kicks), WORLD.width / 2, 120);
  ctx.font = `700 16px ${BODY_FONT}`;
  ctx.fillStyle = 'rgba(20,40,60,0.75)';
  ctx.fillText(`${def.name}${state.best[def.id] ? `　最高 ${state.best[def.id]}回` : ''}`, WORLD.width / 2, 150);

  if (body.state === 'ready') {
    ctx.font = `700 20px ${BODY_FONT}`;
    ctx.fillStyle = '#1c3d5a';
    ctx.fillText('モノをタップして蹴り上げよう', WORLD.width / 2, body.y + body.r + 44);
    ctx.font = `500 14px ${BODY_FONT}`;
    ctx.fillText('左側を蹴ると右へ、右側を蹴ると左へ飛ぶ', WORLD.width / 2, body.y + body.r + 68);
  }

  if (state.notice) {
    const y = 20 + Math.min(1, (1.8 - state.notice.life) * 6) * 10;
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.beginPath();
    ctx.roundRect(24, y, WORLD.width - 48, 54, 14);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#495057';
    ctx.font = `500 12px ${BODY_FONT}`;
    ctx.fillText('通知', 40, y + 20);
    ctx.fillStyle = '#212529';
    ctx.font = `700 15px ${BODY_FONT}`;
    ctx.fillText(state.notice.text, 40, y + 40);
  }
}

function render() {
  const { scale, ox, oy } = state.view;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#40c057';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const shake = state.shake > 0 ? (Math.random() - 0.5) * 12 * state.shake : 0;
  ctx.setTransform(scale, 0, 0, scale, ox + shake * scale, oy);
  drawBackground();
  if (state.body) {
    drawObject();
    drawEffects();
    if (state.screen !== 'menu') drawHud();
  }
}

// ---------- ループ ----------
let last = performance.now();
let acc = 0;
function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  while (acc >= STEP) {
    update(STEP);
    acc -= STEP;
  }
  render();
  requestAnimationFrame(frame);
}

// メニューの背景にもボールを置いておく
state.def = getObject('ball');
state.body = createBody(state.def);
showMenu();
requestAnimationFrame(frame);

// 動作確認用（自動テストからゲームの状態を見られるようにする）
window.__hennaLifting = { state, startGame, toWorld };
