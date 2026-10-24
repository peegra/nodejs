// リフティングするモノの定義。数値はゲーム内の論理座標（幅400×高さ700）での値。
//   gravity        重力（px/秒²）。大きいほど速く落ちる
//   kickSpeed      蹴ったときの上向きの速さ
//   drag           空気抵抗（1秒あたりの減速の割合）
//   radius         当たり判定の半径
//   shrinkPerKick  蹴るたびに小さくなる割合（おにぎり）
//   minRadius      これより小さくならない
//   grains         最初の米粒の数（おにぎり）。小さくなると面積に比例して減る
//   fragile        中心から外れた蹴り（|ずれ| > threshold）を maxCracks 回まで耐える
//   levels         レベル（10回ごとに上がる、Lv1〜Lv6）ごとの値。配列の i 番目が Lv(i+1)
//     wind           横風の強さ（ボール）
//     windName       画面に出す風の強さの呼び名（ボール）
//     crackThreshold ヒビが入らない「真ん中」の幅（生卵）
//     seedsPerKick   蹴るたびに飛んでくる種の数（すいか）
//     seedSlide      張り付いた種が垂れる速さ px/秒。設定しなければ垂れずに張り付いたまま（すいか）
//   seedSizes      飛んでくる種の大きさの候補（倍率）。毎回この中からランダムに選ぶ（すいか）
//     callEvery / callCover / callOpacity  着信が来る間隔（秒）、画面を覆う割合、濃さ（スマホ）
//   comments       結果画面のコメント。Lv1 / Lv2・3 / Lv4・5 / Lv6 の4段階 × 4つ。各段階の4つ目はレア（25回に1回）

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
    levels: {
      wind: [0, 140, 240, 340, 440, 540],
      windName: ['むふう', 'そよかぜ', 'かぜ', 'つよいかぜ', 'きょうふう', 'ぼうふう'],
    },
    intro: '10回ごとに 横風が強くなる。',
    comments: [
      // Lv1
      ['ポトッ。風のせいにしよう。', 'まだ むふう です。', 'ボールは友だち、のはずだった。',
       '監督が見ていなかったので、ノーカウントです。'],
      // Lv2・3
      ['そよかぜに負けた。', '風を読む力が、少しついてきた。', 'ボールが風に連れていかれた。',
       '風の精霊と目が合った。'],
      // Lv4・5
      ['強風の中、よくがんばった。', '気象予報士より風にくわしい。', 'ボールより先に心が飛ばされた。',
       '隣町の子がボールを返しにきた。'],
      // Lv6
      ['暴風リフティングの伝説になった。', '台風が道をゆずった。', '天気予報に名前がのった。',
       '風神が弟子入りを申し込んできた。'],
    ],
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
    grains: 2000,
    intro: '蹴るたびに米粒が飛んで、小さくなる。',
    comments: [
      // Lv1
      ['砂まみれ。もう食べられません。', '3秒ルールは適用外です。', '具が何だったのか、だれも知らない。',
       'ハトが拾って、満足そうに帰っていった。'],
      // Lv2・3
      ['ふりかけのように米粒が舞った。', 'おにぎりが、おむすびに縮んだ。', 'お母さんに見せられない姿。',
       '米粒で地面に「たすけて」と書いてあった。'],
      // Lv4・5
      ['残ったのは、ほぼ梅干し。', '校庭に、ごはん一杯分が散らばった。', 'のりだけが最後まで戦った。',
       '米農家さんから、静かに手紙が届いた。'],
      // Lv6
      ['もはや米粒ひとつぶのリフティング。', 'にぎった人も、これは想定外。', '伝説のおにぎり職人に認められた。',
       '散った米粒から、田んぼができた。'],
    ],
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
    comments: [
      // Lv1
      ['グシャッ。', '足が黄身まみれ。', '今日の朝ごはん、なくなりました。',
       '中から、ひよこが「ちょっと」と言った。'],
      // Lv2・3
      ['目玉焼きになる夢は、終わった。', '卵1個、ていねいにお別れしました。', '殻のかけらが、まだ靴に入ってる。',
       'ニワトリがこっちを見ている。'],
      // Lv4・5
      ['卵かけごはん、何杯分の損失？', 'ここまで割れなかったのが奇跡。', 'スーパーの特売日に、また会おう。',
       '割れた殻が、きれいなハート形だった。'],
      // Lv6
      ['伝説の卵、ついに力つきる。', '卵の扱いだけなら、プロ級。', 'パティシエからスカウトが来た。',
       '金の卵だった気がする。'],
    ],
  },
  {
    id: 'watermelon',
    name: 'すいか',
    emoji: '🍉',
    gravity: 2700,
    kickSpeed: 1150,
    drag: 0.02,
    radius: 58,
    seedSizes: [1, 1.5, 2],
    levels: { seedsPerKick: [1, 2, 2, 3, 4, 4] },
    intro: '蹴るたびに種が飛んできて、画面に張り付く。',
    comments: [
      // Lv1
      ['ボコッ。スイカ割り大会になりました。', '夏が、一瞬で終わった。', '種より先に、心が飛んだ。',
       'カブトムシが集まってきた。'],
      // Lv2・3
      ['画面が少し、すいか柄になった。', '種の数、数える気になれない。', '塩をふる前に終わった。',
       '隣の家の庭から、芽が出たらしい。'],
      // Lv4・5
      ['画面のほとんどが種。', 'これはもう、すいかの種まき。', '夏休みの自由研究にできそう。',
       '農家さんに「来年もたのむ」と言われた。'],
      // Lv6
      ['前が見えないのに、まだ蹴っていた。', '種の向こうに、伝説が見えた。', 'すいか割りの逆、すいか守り名人。',
       '来年の夏、ここはすいか畑になる。'],
    ],
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
    comments: [
      // Lv1
      ['画面バキバキ。修理代いくら？', '保護フィルム、貼っておけばよかった。', '通知が1件、たまってます。',
       '落とした瞬間、母から「大丈夫？」とLINEが来た。'],
      // Lv2・3
      ['着信に気をとられた。', '電話に出なかったぶん、心が痛い。', 'ロック画面にヒビの模様ができた。',
       '非通知の留守電に「ナイスリフティング」と入っていた。'],
      // Lv4・5
      ['着信履歴が、すごいことになってる。', 'もうスマホというより、ガラス片。', '機種変更の言い訳ができた。',
       'コーチから「今日は休んでいい」と来ていた。'],
      // Lv6
      ['鳴り続ける電話を、全部無視した伝説の人。', '着信より速く、足が動いていた。', '修理代より、記録のほうが価値がある。',
       '電話の相手は、未来の自分だった。'],
    ],
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

// 結果画面のコメントの段階（0: Lv1, 1: Lv2・3, 2: Lv4・5, 3: Lv6）
export function commentTier(level) {
  return level >= 6 ? 3 : level >= 4 ? 2 : level >= 2 ? 1 : 0;
}

export const RARE_CHANCE = 1 / 25;

// 結果画面のコメントを選ぶ。各段階の4つ目がレアで、25回に1回だけ出る
export function pickComment(def, kicks, rand = Math.random) {
  const list = def.comments[commentTier(levelOf(kicks))];
  if (rand() < RARE_CHANCE) return { text: list[3], rare: true };
  return { text: list[Math.floor(rand() * 3)], rare: false };
}
