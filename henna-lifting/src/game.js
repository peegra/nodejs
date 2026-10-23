import { OBJECTS, getObject } from './objects.js';
import { WORLD, createBody, remainingPct, step, tryKick } from './physics.js';

const canvas = document.getElementById('stage');
const screen = canvas.getContext('2d');
// 低い解像度で描いてから拡大し、昔のゲーム機のようなドット絵に見せる
const PIX = 0.5;
const buf = document.createElement('canvas');
buf.width = WORLD.width * PIX;
buf.height = WORLD.height * PIX;
const ctx = buf.getContext('2d');
const $ = (id) => document.getElementById(id);

const STEP = 1 / 120;
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const PIXEL_FONT = '"Press Start 2P",monospace';
const DOT_FONT = '"DotGothic16",monospace';

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
function tone(freq, dur = 0.08, type = 'square', gain = 0.1, slideTo) {
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

// ---------- 画面遷移（タイトル → ステージ選択 → プレイ → リザルト） ----------
function showTitle() {
  state.screen = 'title';
  $('menu').hidden = true;
  $('result').hidden = true;
  $('title').hidden = false;
  const total = Object.values(state.best).reduce((a, b) => a + b, 0);
  $('hiscore').textContent = String(total).padStart(5, '0');
}

function showMenu() {
  ensureAudio();
  tone(880, 0.06);
  state.screen = 'menu';
  $('title').hidden = true;
  $('result').hidden = true;
  $('menu').hidden = false;
  const list = $('object-list');
  list.innerHTML = '';
  OBJECTS.forEach((def, i) => {
    const btn = document.createElement('button');
    btn.className = 'object-btn';
    btn.innerHTML = `<span class="stage-no">STAGE ${i + 1}</span>
      <span class="object-icon">${def.emoji || '<span class="tofu-icon"></span>'}</span>
      <span class="object-text"><strong>${def.name}</strong><small>${def.intro}</small></span>
      <span class="object-best">HI ${String(state.best[def.id] ?? 0).padStart(3, '0')}</span>`;
    btn.addEventListener('click', () => startGame(def.id));
    list.appendChild(btn);
  });
  list.querySelector('button')?.focus({ preventScroll: true });
}

$('title').addEventListener('click', showMenu);

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
  $('title').hidden = true;
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
  $('result-head').textContent = body.state === 'broken' ? 'BROKEN!' : 'GAME OVER';
  $('result-title').textContent = `STAGE ${OBJECTS.indexOf(def) + 1}　${def.name}`;
  $('result-score').textContent = String(score).padStart(3, '0');
  $('result-rank').textContent = rankTitle(def, score);
  $('result-extra').textContent = extraLine(def, body);
  $('result-line').textContent = body.state === 'broken' ? def.breakLine : def.groundLine;
  $('result-record').hidden = !isRecord || score === 0;
  updateShareLink();
  $('result').hidden = false;
}

// スコアに応じた称号
export function rankTitle(def, score) {
  if (score >= 50) return `でんせつの ${def.name}しょくにん`;
  if (score >= 30) return `${def.name}の エース`;
  if (score >= 15) return 'レギュラー';
  if (score >= 5) return 'サッカーぶいん';
  return 'みならい';
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
  return `変なものリフティングで「${def.name}」を${body.kicks}回蹴り上げた！称号は「${rankTitle(def, body.kicks)}」${extra ? `（${extra}）` : ''} #変なものリフティング`;
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
    $('copy').textContent = 'コピー できた！';
  } catch {
    $('copy').textContent = 'コピー できなかった';
  }
  setTimeout(() => ($('copy').textContent = 'けっかを コピー'), 1600);
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
  tone(KICK_PITCH[def.id] ?? 500, def.id === 'watermelon' ? 0.12 : 0.07);

  if (result.perfect) addPopup('PERFECT!', body.x, body.y - body.r - 10, '#fcd800');
  if (result.shrank) burst(body.x, body.y, def.id === 'onigiri' ? '#ffffff' : '#f8f4e3', 7, 2.5);
  if (result.cracked && def.fragile) {
    noise(0.08, 0.2);
    addPopup('CRACK!', body.x + body.r, body.y - body.r, '#e40058');
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
  else tone(330, 0.35, 'square', 0.1, 80);
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
        tone(1320, 0.05);
        setTimeout(() => tone(1760, 0.05), 70);
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
function drawCloud(x, y) {
  ctx.fillStyle = '#fcfcfc';
  ctx.fillRect(x, y, 64, 16);
  ctx.fillRect(x + 12, y - 12, 40, 12);
  ctx.fillRect(x + 24, y - 20, 16, 8);
}

function drawBackground() {
  ctx.fillStyle = '#5c94fc';
  ctx.fillRect(-200, -400, WORLD.width + 400, WORLD.ground + 400);
  drawCloud(40, 230);
  drawCloud(290, 320);
  drawCloud(170, 430);

  // 遠くのゴール
  ctx.fillStyle = 'rgba(252,252,252,0.45)';
  for (let x = 118; x < 290; x += 16) ctx.fillRect(x, WORLD.ground - 88, 2, 88);
  for (let y = WORLD.ground - 76; y < WORLD.ground; y += 16) ctx.fillRect(110, y, 180, 2);
  ctx.fillStyle = '#fcfcfc';
  ctx.fillRect(106, WORLD.ground - 96, 188, 8);
  ctx.fillRect(106, WORLD.ground - 96, 8, 96);
  ctx.fillRect(286, WORLD.ground - 96, 8, 96);

  // 芝生（しま模様）
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? '#58d854' : '#00a800';
    ctx.fillRect(-200 + i * 100, WORLD.ground, 100, WORLD.height - WORLD.ground + 400);
  }
  ctx.fillStyle = '#fcfcfc';
  ctx.fillRect(-200, WORLD.ground, WORLD.width + 400, 4);
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
    ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
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
    ctx.font = `16px ${PIXEL_FONT}`;
    ctx.fillStyle = '#000';
    ctx.fillText(p.text, p.x + 2, p.y + 2);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}

function pixelText(text, x, y, font, color, shadow = '#000') {
  ctx.font = font;
  ctx.fillStyle = shadow;
  ctx.fillText(text, x + 3, y + 3);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function retroWindow(x, y, w, h) {
  ctx.fillStyle = '#000';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#fcfcfc';
  ctx.fillRect(x + 4, y + 4, w - 8, 4);
  ctx.fillRect(x + 4, y + h - 8, w - 8, 4);
  ctx.fillRect(x + 4, y + 4, 4, h - 8);
  ctx.fillRect(x + w - 8, y + 4, 4, h - 8);
}

function drawHud() {
  const { def, body } = state;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  pixelText(String(body.kicks).padStart(3, '0'), WORLD.width / 2, 120, `64px ${PIXEL_FONT}`, '#fcfcfc');
  ctx.textAlign = 'left';
  pixelText(`STAGE ${OBJECTS.indexOf(def) + 1}`, 16, 36, `16px ${PIXEL_FONT}`, '#fcd800');
  ctx.textAlign = 'right';
  pixelText(`HI ${String(state.best[def.id] ?? 0).padStart(3, '0')}`, WORLD.width - 64, 36, `16px ${PIXEL_FONT}`, '#fcfcfc');
  ctx.textAlign = 'center';
  pixelText(def.name, WORLD.width / 2, 164, `24px ${DOT_FONT}`, '#fcfcfc');

  if (body.state === 'ready') {
    const y = Math.min(WORLD.ground - 120, body.y + body.r + 24);
    retroWindow(28, y, WORLD.width - 56, 92);
    ctx.font = `24px ${DOT_FONT}`;
    ctx.fillStyle = '#fcfcfc';
    ctx.fillText('モノを タップして けりあげろ！', WORLD.width / 2, y + 40);
    ctx.font = `20px ${DOT_FONT}`;
    ctx.fillStyle = '#fcd800';
    ctx.fillText('はしを けると はんたいへ とぶ', WORLD.width / 2, y + 72);
  }

  if (state.notice) {
    const y = 48 + Math.min(1, (1.8 - state.notice.life) * 6) * 8;
    retroWindow(20, y, WORLD.width - 40, 72);
    ctx.textAlign = 'left';
    ctx.font = `12px ${PIXEL_FONT}`;
    ctx.fillStyle = '#e40058';
    ctx.fillText('NEW MESSAGE', 36, y + 30);
    ctx.font = `20px ${DOT_FONT}`;
    ctx.fillStyle = '#fcfcfc';
    ctx.fillText(state.notice.text, 36, y + 56);
  }
}

function render() {
  const { scale, ox, oy } = state.view;
  const shake = state.shake > 0 ? Math.round((Math.random() - 0.5) * 12 * state.shake) : 0;
  ctx.setTransform(PIX, 0, 0, PIX, shake * PIX, 0);
  ctx.imageSmoothingEnabled = false;
  drawBackground();
  if (state.body && state.screen !== 'title') {
    drawObject();
    drawEffects();
    if (state.screen === 'play' || state.screen === 'over') drawHud();
  }
  // 小さく描いた画面を、ぼかさずに拡大する
  screen.setTransform(1, 0, 0, 1, 0, 0);
  screen.imageSmoothingEnabled = false;
  screen.fillStyle = '#000';
  screen.fillRect(0, 0, canvas.width, canvas.height);
  screen.drawImage(buf, ox, oy, WORLD.width * scale, WORLD.height * scale);
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
showTitle();
requestAnimationFrame(frame);

// 動作確認用（自動テストからゲームの状態を見られるようにする）
window.__hennaLifting = { state, startGame, toWorld };
