import { OBJECTS, getObject, levelOf, levelValue } from './objects.js';
import { WORLD, createBody, remainingPct, step, tryKick, windForce } from './physics.js';

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
  seeds: [], // すいかの種（飛んできて画面に張り付き、垂れて下に溜まる）
  pile: [], // 画面の下に溜まった種の高さ（横 20px ごと）
  streaks: [], // 風の筋と葉っぱ
  flyers: [], // タイトル画面を横切るモノ
  nextFlyerAt: 0.2,
  streakAcc: 0,
  cloudShift: 0,
  call: null, // スマホの着信画面
  nextCallAt: 0,
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
    // iPhone は消音モードだと Web Audio が鳴らないので、音楽再生扱いにしてもらう（Safari 17 以降）
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch {}
    try {
      audio = new AudioContext();
    } catch {
      audio = null;
    }
  }
  // iPhone は電話やアプリ切り替えのあと 'interrupted' になって止まる
  if (audio && audio.state !== 'running') audio.resume().catch(() => {});
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
// リアル寄りの効果音: 低い「ドン」（音程が下がるサイン波）と、こすれ・弾ける音（フィルターをかけたノイズ）の組み合わせ
function thump(f0, f1, dur, gain, delay = 0) {
  if (state.muted || !audio) return;
  const t = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(audio.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

let noiseBuf = null;
function hiss(dur, gain, type, freq, { q = 1, sweepTo, delay = 0 } = {}) {
  if (state.muted || !audio) return;
  noiseBuf ??= makeNoise(1);
  const t = audio.currentTime + delay;
  const src = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const g = audio.createGain();
  src.buffer = noiseBuf;
  filter.type = type;
  filter.frequency.setValueAtTime(freq, t);
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  filter.Q.value = q;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(audio.destination);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

function makeNoise(seconds) {
  const buf = audio.createBuffer(1, Math.floor(audio.sampleRate * seconds), audio.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

const KICK_SFX = {
  ball: () => { thump(170, 55, 0.13, 0.7); hiss(0.05, 0.35, 'bandpass', 1700, { q: 1.2 }); },
  onigiri: () => { thump(130, 70, 0.08, 0.35); hiss(0.08, 0.3, 'lowpass', 900, { q: 0.7 }); },
  egg: () => { thump(950, 520, 0.035, 0.22); hiss(0.025, 0.25, 'highpass', 3200, { q: 0.8 }); },
  watermelon: () => { thump(105, 42, 0.24, 0.9); hiss(0.12, 0.35, 'lowpass', 650, { q: 0.8 }); },
  phone: () => { hiss(0.03, 0.4, 'highpass', 2600, { q: 1 }); thump(620, 300, 0.05, 0.2); },
};

const LAND_SFX = {
  ball: () => { thump(120, 40, 0.2, 0.6); hiss(0.1, 0.25, 'lowpass', 450); thump(110, 45, 0.12, 0.25, 0.18); },
  onigiri: () => { hiss(0.22, 0.4, 'lowpass', 520, { sweepTo: 200 }); thump(90, 50, 0.12, 0.3); },
  egg: () => { hiss(0.05, 0.4, 'highpass', 2200); hiss(0.4, 0.55, 'bandpass', 900, { q: 0.9, sweepTo: 250, delay: 0.03 }); },
  watermelon: () => {
    thump(85, 30, 0.45, 1);
    hiss(0.35, 0.6, 'lowpass', 900, { sweepTo: 300 });
    hiss(0.25, 0.3, 'bandpass', 1500, { q: 1.5, delay: 0.06 });
  },
  phone: () => {
    thump(160, 70, 0.08, 0.4);
    hiss(0.3, 0.4, 'highpass', 4200);
    [3100, 4300, 3700, 5200].forEach((f, i) => setTimeout(() => tone(f, 0.05, 'sine', 0.05), 30 + i * 45));
  },
};

// 風の音（ノイズを流し続け、風の強さに合わせて音量と高さを変える）
let windNode = null;
function startWindSound() {
  if (!audio || windNode) return;
  const src = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const g = audio.createGain();
  src.buffer = makeNoise(2);
  src.loop = true;
  filter.type = 'lowpass';
  filter.frequency.value = 300;
  g.gain.value = 0;
  src.connect(filter).connect(g).connect(audio.destination);
  src.start();
  windNode = { src, filter, g };
}
function setWindSound(k) {
  if (!windNode) return;
  const t = audio.currentTime;
  windNode.g.gain.setTargetAtTime(state.muted ? 0 : k * 0.22, t, 0.25);
  windNode.filter.frequency.setTargetAtTime(280 + k * 900, t, 0.25);
}
function stopWindSound() {
  windNode?.src.stop();
  windNode = null;
}

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
      <span class="object-icon">${def.emoji}</span>
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
  state.seeds = [];
  state.pile = new Array(Math.ceil(WORLD.width / 20)).fill(0);
  state.streaks = [];
  state.streakAcc = 0;
  state.call = null;
  state.nextCallAt = levelValue(state.def, 'callEvery', 1);
  state.overTimer = 0;
  state.shake = 0;
  state.screen = 'play';
  stopWindSound();
  if (state.def.levels?.wind) startWindSound();
  $('title').hidden = true;
  $('menu').hidden = true;
  $('result').hidden = true;
}

function endGame() {
  state.screen = 'over';
  stopWindSound();
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
  if (def.id === 'egg') return `ヒビ ${body.cracks}本`;
  if (def.id === 'phone') return `画面のヒビ ${body.cracks}本`;
  return state.best[def.id] ? `自己ベスト ${state.best[def.id]}回` : '';
}

function shareText() {
  const { def, body } = state;
  const extra = extraLine(def, body);
  return `変なものリフティングで「${def.name}」を${body.kicks}回蹴り上げた！称号は「${rankTitle(def, body.kicks)}」${extra ? `（${extra}）` : ''} #変なものリフティング`;
}

// X の投稿画面と LINE の送信画面へのリンク（スマホの共有メニューが使えない環境でも動くように、普通のリンクにしている）
function updateShareLink() {
  const url = location.href.split('#')[0];
  const text = shareText();
  $('share').href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  $('line').href = `https://line.me/R/share?text=${encodeURIComponent(`${text}\n${url}`)}`;
}

$('retry').addEventListener('click', () => startGame(state.def.id));
$('change').addEventListener('click', showMenu);
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
  const levelBefore = levelOf(body.kicks);
  const result = tryKick(body, def, p.x, p.y);
  if (!result) return;
  if (levelOf(body.kicks) > levelBefore) levelUp(levelOf(body.kicks));
  const seeds = levelValue(def, 'seedsPerKick', levelBefore);
  if (seeds) spitSeeds(seeds, levelValue(def, 'seedSlide', levelBefore, 0));

  state.feet.push({ x: p.x, y: p.y + body.r * 0.6, life: 0.18, flip: result.offset > 0 });
  KICK_SFX[def.id]?.();

  if (result.perfect) addPopup('PERFECT!', body.x, body.y - body.r - 10, '#fcd800');
  if (result.shrank) burst(body.x, body.y, def.id === 'onigiri' ? '#ffffff' : '#f8f4e3', 7, 2.5);
  if (result.cracked && def.fragile) {
    hiss(0.04, 0.35, 'highpass', 2800);
    addPopup('CRACK!', body.x + body.r, body.y - body.r, '#e40058');
  }
  if (result.broke) {
    LAND_SFX.egg();
    burst(body.x, body.y, def.id === 'egg' ? '#ffd43b' : '#f8f4e3', 24, 4);
    state.shake = 0.3;
  }
});

// ---------- 演出 ----------
function addPopup(text, x, y, color, size = 16, life = 0.7) {
  state.popups.push({ text, x, y, color, size, life });
}

function levelUp(level) {
  addPopup('LEVEL UP!', WORLD.width / 2, 330, '#fcd800', 32, 1.4);
  addPopup(`Lv${level}`, WORLD.width / 2, 370, '#fcfcfc', 24, 1.4);
  [660, 880, 1320].forEach((f, i) => setTimeout(() => tone(f, 0.09), i * 90));
}

// すいかの種: すいかの位置からこちらに向かって飛んできて、画面に張り付く
const SEED_FLY = 0.22; // 飛んでくるのにかかる秒数
function spitSeeds(count, slide) {
  const { def, body } = state;
  const sizes = def.seedSizes ?? [1];
  for (let i = 0; i < count; i++) {
    state.seeds.push({
      sx: body.x + (Math.random() - 0.5) * body.r,
      sy: body.y + (Math.random() - 0.5) * body.r,
      x: 40 + Math.random() * (WORLD.width - 80),
      y: 180 + Math.random() * 360,
      angle: (Math.random() - 0.5) * 0.8,
      t: 0,
      stuck: false,
      landed: false,
      splat: 0,
      slide: slide * (0.8 + Math.random() * 0.4),
      size: sizes[Math.floor(Math.random() * sizes.length)],
    });
  }
}

function ringtone() {
  [0, 160, 480, 640].forEach((t, i) => setTimeout(() => tone(i % 2 ? 988 : 1319, 0.12), t));
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
  const colors = { egg: '#ffd43b', watermelon: '#e03131', phone: '#adb5bd', onigiri: '#ffffff' };
  if (colors[def.id]) burst(body.x, WORLD.ground - 4, colors[def.id], def.id === 'watermelon' ? 30 : 16, 4);
  LAND_SFX[def.id]?.();
}

// ---------- 更新 ----------
const SEED_H = 44; // 張り付いた種の高さ（縦長）
function updateSeeds(dt) {
  const floor = WORLD.height - 6;
  for (const seed of state.seeds) {
    if (!seed.stuck) {
      seed.t += dt;
      if (seed.t >= SEED_FLY) {
        seed.stuck = true;
        seed.splat = 0.12;
        hiss(0.05, 0.18, 'bandpass', 1100, { q: 1.4 });
      }
      continue;
    }
    seed.splat = Math.max(0, seed.splat - dt);
    if (seed.landed || !seed.slide) continue; // 垂れる設定がなければ張り付いたまま
    // 剥がれずにゆっくり垂れていき、画面の下（すでに溜まった種の上）で止まる
    const bin = Math.min(state.pile.length - 1, Math.max(0, Math.floor(seed.x / 20)));
    const stopAt = floor - state.pile[bin] - (SEED_H * seed.size) / 2;
    seed.y = Math.min(stopAt, seed.y + seed.slide * dt);
    if (seed.y >= stopAt) {
      seed.landed = true;
      state.pile[bin] += SEED_H * seed.size * 0.45;
    }
  }
}

// タイトル画面: ランダムなモノが、蹴られたように回転しながら画面を横切る
function updateFlyers(dt) {
  if (state.screen !== 'title') {
    state.flyers = [];
    return;
  }
  state.nextFlyerAt -= dt;
  if (state.nextFlyerAt <= 0) {
    const count = Math.random() < 0.35 ? 2 + Math.floor(Math.random() * 3) : 1;
    for (let i = 0; i < count; i++) spawnFlyer();
    state.nextFlyerAt = 0.35 + Math.random() * 0.8;
  }
  for (const f of state.flyers) {
    f.vy += 520 * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.angle += f.spin * dt;
    if (f.y > WORLD.ground - f.size / 2 && f.vy > 0) {
      f.y = WORLD.ground - f.size / 2;
      f.vy *= -0.55; // 芝生で弾む
    }
  }
  state.flyers = state.flyers.filter((f) => f.x > -120 && f.x < WORLD.width + 120);
}

function spawnFlyer() {
  const def = OBJECTS[Math.floor(Math.random() * OBJECTS.length)];
  const fromLeft = Math.random() < 0.5;
  state.flyers.push({
    emoji: def.emoji,
    x: fromLeft ? -60 - Math.random() * 60 : WORLD.width + 60 + Math.random() * 60,
    y: 300 + Math.random() * 300,
    vx: (fromLeft ? 1 : -1) * (150 + Math.random() * 200),
    vy: -(350 + Math.random() * 380),
    angle: 0,
    spin: (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 6),
    size: 44 + Math.random() * 46,
  });
}

function drawFlyers() {
  for (const f of state.flyers) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.angle);
    ctx.font = `${f.size}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000';
    ctx.fillText(f.emoji, 0, 0);
    ctx.restore();
  }
}

// 画面全体を流れる風の筋と葉っぱ、雲の流れ
function updateWind(dt) {
  const { def, body } = state;
  const force = def?.levels?.wind && state.screen === 'play' && body.state === 'flying' ? windForce(body, def) : 0;
  const k = Math.min(1, Math.abs(force) / 540);
  setWindSound(k);
  state.cloudShift += force * dt * 0.12;
  if (k > 0.05) {
    state.streakAcc += dt * (8 + 70 * k);
    while (state.streakAcc >= 1) {
      state.streakAcc -= 1;
      const dir = Math.sign(force);
      const leaf = Math.random() < 0.06 + 0.12 * k;
      state.streaks.push({
        x: dir > 0 ? -80 : WORLD.width + 80,
        y: Math.random() * (WORLD.ground - 20),
        len: leaf ? 0 : 24 + 70 * k + Math.random() * 40,
        v: dir * (260 + 700 * k) * (0.8 + Math.random() * 0.4),
        leaf,
        phase: Math.random() * 6,
      });
    }
  }
  for (const st of state.streaks) {
    st.x += st.v * dt;
    st.phase += dt * 8;
    if (st.leaf) st.y += Math.sin(st.phase) * 40 * dt;
  }
  state.streaks = state.streaks.filter((st) => st.x > -200 && st.x < WORLD.width + 200);
}
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

    // スマホ: レベルが上がるほど、着信が頻繁に・広く・濃く画面を覆う
    if (def.levels?.callEvery && state.screen === 'play' && body.state === 'flying') {
      if (state.call) {
        state.call.life -= dt;
        if (state.call.life <= 0) state.call = null;
      } else {
        state.nextCallAt -= dt;
        if (state.nextCallAt <= 0) {
          const level = levelOf(body.kicks);
          state.call = {
            caller: def.callers[Math.floor(Math.random() * def.callers.length)],
            life: 1.6,
            cover: levelValue(def, 'callCover', level),
            opacity: levelValue(def, 'callOpacity', level),
          };
          state.nextCallAt = levelValue(def, 'callEvery', level);
          ringtone();
        }
      }
    }
    if (state.screen !== 'play') state.call = null;
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
  updateSeeds(dt);
  updateWind(dt);
  updateFlyers(dt);
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
  const span = WORLD.width + 160;
  const wrap = (x) => ((((x + state.cloudShift) % span) + span) % span) - 80;
  drawCloud(wrap(40), 230);
  drawCloud(wrap(290), 320);
  drawCloud(wrap(170), 430);

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
  ctx.font = `${body.r * 2.1}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000'; // 絵文字も fillStyle の透明度の影響を受けるので不透明にしておく
  ctx.fillText(def.emoji, 0, body.r * 0.08);
  if (body.cracks) drawCracks(body, body.cracks, def.id === 'phone' ? 'rgba(255,255,255,0.9)' : 'rgba(80,50,20,0.8)');
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

}

function pixelText(text, x, y, font, color, shadow = '#000') {
  ctx.font = font;
  ctx.fillStyle = shadow;
  ctx.fillText(text, x + 3, y + 3);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

// 幅 maxWidth に収まるまで文字を小さくして書く（長い名前でも枠からはみ出さないように）
function fitText(text, x, y, size, maxWidth, color) {
  let px = size;
  ctx.font = `${px}px ${DOT_FONT}`;
  while (px > 12 && ctx.measureText(text).width > maxWidth) {
    px -= 1;
    ctx.font = `${px}px ${DOT_FONT}`;
  }
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
  pixelText(`Lv${levelOf(body.kicks)}`, 16, 64, `16px ${PIXEL_FONT}`, '#fcfcfc');
  ctx.textAlign = 'right';
  pixelText(`HI ${String(state.best[def.id] ?? 0).padStart(3, '0')}`, WORLD.width - 64, 36, `16px ${PIXEL_FONT}`, '#fcfcfc');
  ctx.textAlign = 'center';
  pixelText(def.name, WORLD.width / 2, 164, `24px ${DOT_FONT}`, '#fcfcfc');
  drawWind();

  if (body.state === 'ready') {
    const y = Math.min(WORLD.ground - 120, body.y + body.r + 24);
    const w = WORLD.width - 56;
    retroWindow(28, y, w, 92);
    const inner = w - 40; // 白枠の内側に収まる幅
    fitText(`${def.name}タップでリフティング`, WORLD.width / 2, y + 42, 24, inner, '#fcfcfc');
    fitText('めざせ！リフティングキング！', WORLD.width / 2, y + 74, 20, inner, '#fcd800');
  }

}

// ボールの風向きと強さ（矢印の数）
function drawWind() {
  const { def, body } = state;
  const force = windForce(body, def);
  if (!def.levels?.wind || body.state === 'ready') return;
  const strength = Math.min(4, Math.round(Math.abs(force) / 120));
  const arrows = strength ? (force > 0 ? '>'.repeat(strength) : '<'.repeat(strength)) : '-';
  ctx.textAlign = 'center';
  pixelText(`WIND ${arrows}`, WORLD.width / 2, 200, `16px ${PIXEL_FONT}`, strength >= 3 ? '#e40058' : '#fcfcfc');
}

function drawSeed(x, y, scale, angle, squash) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale * (1 + squash), scale * (1 - squash));
  // しずく形の黒い種（上がとがっている）
  ctx.fillStyle = '#1a0e08';
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.quadraticCurveTo(15, -6, 13, 8);
  ctx.quadraticCurveTo(10, 22, 0, 22);
  ctx.quadraticCurveTo(-10, 22, -13, 8);
  ctx.quadraticCurveTo(-15, -6, 0, -22);
  ctx.fill();
  ctx.fillStyle = '#4a3020';
  ctx.fillRect(-4, 10, 10, 6);
  ctx.fillStyle = '#d8d0c0';
  ctx.fillRect(-7, -6, 4, 8);
  ctx.restore();
}

function drawSeeds() {
  for (const seed of state.seeds) {
    if (!seed.stuck) {
      // 小さい状態から大きくなりながら、こちらに飛んでくる
      const p = 1 - (1 - seed.t / SEED_FLY) ** 2;
      const x = seed.sx + (seed.x - seed.sx) * p;
      const y = seed.sy + (seed.y - seed.sy) * p;
      drawSeed(x, y, (0.2 + 0.8 * p) * seed.size, seed.angle + (1 - p) * 4, 0);
    } else {
      drawSeed(seed.x, seed.y, seed.size, seed.angle, seed.splat > 0 ? 0.25 : 0);
    }
  }
}

// LEVEL UP! や PERFECT! などの文字。すいかの種より手前に描く
function drawPopups() {
  ctx.textAlign = 'center';
  for (const p of state.popups) {
    ctx.globalAlpha = Math.min(1, p.life * 2);
    ctx.font = `${p.size}px ${PIXEL_FONT}`;
    ctx.fillStyle = '#000';
    ctx.fillText(p.text, p.x + p.size / 8, p.y + p.size / 8);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}

function drawStreaks() {
  for (const st of state.streaks) {
    if (st.leaf) {
      ctx.save();
      ctx.translate(st.x, st.y);
      ctx.rotate(st.phase);
      ctx.fillStyle = '#58d854';
      ctx.fillRect(-6, -4, 12, 8);
      ctx.fillStyle = '#00a800';
      ctx.fillRect(-6, -1, 12, 2);
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(252,252,252,0.8)';
      ctx.fillRect(st.x, st.y, st.len, 4);
    }
  }
}

// スマホの着信画面。cover の割合だけ上から画面を覆う
function drawCall() {
  const call = state.call;
  if (!call) return;
  const h = WORLD.height * call.cover;
  ctx.fillStyle = `rgba(0,0,0,${call.opacity})`;
  ctx.fillRect(0, 0, WORLD.width, h);
  const y = Math.max(16, h / 2 - 70);
  retroWindow(36, y, WORLD.width - 72, 140);
  ctx.textAlign = 'center';
  ctx.font = `12px ${PIXEL_FONT}`;
  ctx.fillStyle = Math.floor(call.life * 6) % 2 ? '#fcd800' : '#fcfcfc';
  ctx.fillText('INCOMING CALL', WORLD.width / 2, y + 34);
  ctx.font = `28px ${DOT_FONT}`;
  ctx.fillStyle = '#fcfcfc';
  ctx.fillText(call.caller, WORLD.width / 2, y + 74);
  ctx.fillStyle = '#00a800';
  ctx.fillRect(64, y + 92, 120, 32);
  ctx.fillStyle = '#e40058';
  ctx.fillRect(WORLD.width - 184, y + 92, 120, 32);
  ctx.font = `18px ${DOT_FONT}`;
  ctx.fillStyle = '#fcfcfc';
  ctx.fillText('おうとう', 124, y + 115);
  ctx.fillText('きょひ', WORLD.width - 124, y + 115);
}

function render() {
  const { scale, ox, oy } = state.view;
  const shake = state.shake > 0 ? Math.round((Math.random() - 0.5) * 12 * state.shake) : 0;
  ctx.setTransform(PIX, 0, 0, PIX, shake * PIX, 0);
  ctx.imageSmoothingEnabled = false;
  drawBackground();
  if (state.screen === 'title') drawFlyers();
  if (state.body && state.screen !== 'title') {
    drawStreaks();
    drawObject();
    drawEffects();
    drawSeeds();
    drawPopups();
    if (state.screen === 'play' || state.screen === 'over') drawHud();
    drawCall();
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
