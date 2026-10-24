// リフティングするモノの定義。数値はゲーム内の論理座標（幅400×高さ700）での値。
//   gravity        重力（px/秒²）。大きいほど速く落ちる
//   kickSpeed      蹴ったときの上向きの速さ
//   drag           空気抵抗（1秒あたりの減速の割合）
//   radius         当たり判定の半径
//   shrinkPerKick  蹴るたびに小さくなる割合（おにぎり）
//   minRadius      これより小さくならない
//   fragile        中心から外れた蹴り（|ずれ| > threshold）を maxCracks 回まで耐える
//   levels         レベル（10回ごとに上がる、Lv1〜Lv6）ごとの値。配列の i 番目が Lv(i+1)
//     wind           横風の強さ（ボール）
//     crackThreshold ヒビが入らない「真ん中」の幅（生卵）
//     seedsPerKick / seedSeconds  蹴るたびに画面に張り付く種の数と、張り付いている秒数（すいか）
//     callEvery / callCover / callOpacity  着信が来る間隔（秒）、画面を覆う割合、濃さ（スマホ）

export const MAX_LEVEL = 6;
export const KICKS_PER_LEVEL = 10;

export const OBJECTS = [
  {
    id: 'ball',
    name: 'サッカーボール',
    emoji: '⚽',
    gravity: 1800,
    kickSpeed: 980,
    drag: 0.05,
    radius: 42,
    levels: { wind: [0, 140, 240, 340, 440, 540] },
    intro: '10回ごとに 横風が強くなる。',
    groundLine: 'ポトッ。風のせいにしよう。',
  },
  {
    id: 'onigiri',
    name: 'おにぎり',
    emoji: '🍙',
    gravity: 1700,
    kickSpeed: 940,
    drag: 0.08,
    radius: 46,
    shrinkPerKick: 0.035,
    minRadius: 16,
    intro: '蹴るたびに米粒が飛んで、小さくなる。',
    groundLine: '砂まみれ。もう食べられません。',
  },
  {
    id: 'egg',
    name: '生卵',
    emoji: '🥚',
    gravity: 1750,
    kickSpeed: 950,
    drag: 0.05,
    radius: 38,
    fragile: { threshold: 0.68, maxCracks: 3 },
    levels: { crackThreshold: [0.68, 0.63, 0.58, 0.53, 0.49, 0.45] },
    intro: '真ん中以外を蹴るとヒビ。4回目で割れる。',
    groundLine: 'グシャッ。',
    breakLine: 'パカッ。足が黄身まみれ。',
  },
  {
    id: 'watermelon',
    name: 'すいか',
    emoji: '🍉',
    gravity: 2700,
    kickSpeed: 1150,
    drag: 0.02,
    radius: 58,
    levels: { seedsPerKick: [1, 2, 2, 3, 4, 4], seedSeconds: [2.5, 3, 3.5, 4, 4.5, 5] },
    intro: '蹴るたびに種が飛んで、画面に張り付く。',
    groundLine: 'ボコッ。スイカ割り大会になりました。',
  },
  {
    id: 'phone',
    name: 'スマホ',
    emoji: '📱',
    gravity: 1900,
    kickSpeed: 1000,
    drag: 0.04,
    radius: 40,
    cracksOnKick: true,
    callers: ['母', 'コーチ', '塾', '知らない番号', '大家さん', 'おばあちゃん', '非通知'],
    levels: {
      callEvery: [6, 5, 4.2, 3.5, 3, 2.5],
      callCover: [0.25, 0.35, 0.5, 0.62, 0.75, 0.9],
      callOpacity: [0.55, 0.62, 0.7, 0.78, 0.85, 0.9],
    },
    intro: '着信画面が どんどん邪魔してくる。',
    groundLine: '画面バキバキ。修理代いくら？',
  },
];

export function getObject(id) {
  const def = OBJECTS.find((o) => o.id === id);
  if (!def) throw new Error(`unknown object: ${id}`);
  return def;
}

// 蹴った回数からレベル（1〜MAX_LEVEL）を出す
export function levelOf(kicks) {
  return Math.min(MAX_LEVEL, Math.floor(kicks / KICKS_PER_LEVEL) + 1);
}

// レベルごとの値を取り出す。設定がなければ fallback
export function levelValue(def, key, level, fallback = 0) {
  const arr = def.levels?.[key];
  return arr ? arr[Math.min(level, arr.length) - 1] : fallback;
}
