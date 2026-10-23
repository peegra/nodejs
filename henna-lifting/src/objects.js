// リフティングするモノの定義。数値はゲーム内の論理座標（幅400×高さ700）での値。
//   gravity     重力（px/秒²）。大きいほど速く落ちる
//   kickSpeed   蹴ったときの上向きの速さ
//   drag        空気抵抗（1秒あたりの減速の割合）
//   radius      当たり判定の半径
//   shrinkPerKick  蹴るたびに小さくなる割合（おにぎり・豆腐）
//   minRadius   これより小さくならない
//   fragile     中心から外れた蹴り（|ずれ| > threshold）を何回まで耐えるか
//   wind        横風の強さ（風船）
//   notifications  蹴っている最中に通知が出る（スマホ）

export const OBJECTS = [
  {
    id: 'ball',
    name: 'サッカーボール',
    emoji: '⚽',
    gravity: 1800,
    kickSpeed: 980,
    drag: 0.05,
    radius: 42,
    intro: 'まずは普通に。',
    groundLine: 'ポトッ。普通に落ちました。',
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
    fragile: { threshold: 0.45, maxCracks: 2 },
    intro: '真ん中を蹴らないとヒビが入る。3回目で割れる。',
    groundLine: 'グシャッ。',
    breakLine: 'パカッ。足が黄身まみれ。',
  },
  {
    id: 'balloon',
    name: '風船',
    emoji: '🎈',
    gravity: 380,
    kickSpeed: 420,
    drag: 0.9,
    radius: 44,
    wind: 260,
    intro: 'ふわふわ遅い。でも風に流される。',
    groundLine: 'しぼみながら着地。',
  },
  {
    id: 'watermelon',
    name: 'すいか',
    emoji: '🍉',
    gravity: 2700,
    kickSpeed: 1150,
    drag: 0.02,
    radius: 58,
    intro: '重い。すぐ落ちてくる。',
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
    notifications: [
      '母「ご飯できたよ」',
      'コーチ「明日8時集合」',
      '【速報】あなたの推しが結婚',
      'ストレージがいっぱいです',
      'グループLINE（42件）',
      '電池残量 5%',
    ],
    intro: '蹴るたびに画面にヒビ。通知もうるさい。',
    groundLine: '画面バキバキ。修理代いくら？',
  },
  {
    id: 'tofu',
    name: '豆腐',
    emoji: '',
    gravity: 1650,
    kickSpeed: 920,
    drag: 0.1,
    radius: 44,
    shrinkPerKick: 0.06,
    minRadius: 14,
    fragile: { threshold: 0.7, maxCracks: 0 },
    intro: '蹴るたびに角が欠ける。端を蹴ると崩れる。',
    groundLine: 'べちゃっ。',
    breakLine: '崩れました。冷奴失敗。',
  },
];

export function getObject(id) {
  const def = OBJECTS.find((o) => o.id === id);
  if (!def) throw new Error(`unknown object: ${id}`);
  return def;
}
