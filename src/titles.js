// しょうごう（称号）の一覧と、取れたかどうかの判定。
// 1回遊ぶごとに、そのプレイの記録（run）と、これまでの合計（totals）を見て判定する。
//   run    { stage, kicks, perfects, bestStreak, broken, cracks, walls, grains, grainsLost, smallest, seeds, calls, callers, muted, hour, isRecord, prevBest }
//   totals { plays, kicks, playsBy, best, eggsBroken, grainsLost, seeds, calls, records, sameStageStreak }
// hint は、まだ取れていないときに図鑑に出すヒント。

const STAGES = ['ball', 'onigiri', 'egg', 'watermelon', 'phone'];

// 結果画面に出す「今回のしょうごう」。ステージごとに回数で5段階
export const RANK_STEPS = [0, 5, 15, 30, 50];
const RANK_NAMES = {
  ball: ['ボールあそび みならい', 'サッカーぶいん', 'ボールの レギュラー', 'ボールの エース', 'でんせつの ボールしょくにん'],
  onigiri: ['おにぎり みならい', 'おむすび ぶいん', 'おにぎりの レギュラー', 'おにぎりの エース', 'でんせつの にぎりしょくにん'],
  egg: ['たまご みならい', 'たまご ぶいん', 'たまごの レギュラー', 'たまごの エース', 'でんせつの たまごしょくにん'],
  watermelon: ['すいか みならい', 'すいか ぶいん', 'すいかの レギュラー', 'すいかの エース', 'でんせつの すいかしょくにん'],
  phone: ['スマホ みならい', 'スマホ ぶいん', 'スマホの レギュラー', 'スマホの エース', 'でんせつの スマホしょくにん'],
};
const STAGE_NAMES = { ball: 'サッカーボール', onigiri: 'おにぎり', egg: '生卵', watermelon: 'すいか', phone: 'スマホ' };

export function rankIndex(score) {
  let i = 0;
  while (i + 1 < RANK_STEPS.length && score >= RANK_STEPS[i + 1]) i++;
  return i;
}
export function rankTitle(stage, score) {
  return RANK_NAMES[stage][rankIndex(score)];
}

const rankTitles = STAGES.flatMap((stage) =>
  RANK_NAMES[stage].map((name, i) => ({
    id: `${stage}-rank-${i + 1}`,
    name,
    hint: i === 0 ? `${STAGE_NAMES[stage]}で あそぶ` : `${STAGE_NAMES[stage]}で ${RANK_STEPS[i]}回`,
    check: (run) => run.stage === stage && run.kicks >= RANK_STEPS[i],
  })),
);

const exact = (n, name, hint) => ({ id: `exact-${n}`, name, hint, check: (run) => run.kicks === n });
const anyStage = (id, name, hint, check) => ({ id, name, hint, check });
const on = (stage, id, name, hint, check) => ({ id, name, hint, check: (run, totals) => run.stage === stage && check(run, totals) });

const CALLER_TITLES = [
  ['母', 'おかあさん ごめん'],
  ['コーチ', 'れんしゅう サボり'],
  ['塾', 'じゅく サボり'],
  ['知らない番号', 'でちゃ だめな でんわ'],
  ['大家さん', 'やちん まだです'],
  ['おばあちゃん', 'おばあちゃんっこ'],
  ['非通知', 'ひつうち こわい'],
];

export const TITLES = [
  ...rankTitles,

  // ぴったりの回数で終わる
  exact(0, 'からぶり めいじん', 'いちども けらずに おわる'),
  exact(1, 'いっぱつや', 'ぴったり 1回で おわる'),
  exact(3, 'さんどめの しょうじき', 'ぴったり 3回で おわる'),
  exact(7, 'ラッキーセブン', 'ぴったり 7回で おわる'),
  exact(8, 'すえひろがり', 'ぴったり 8回で おわる'),
  exact(11, 'サッカーは 11にん', 'ぴったり 11回で おわる'),
  exact(22, 'にゃんにゃん', 'ぴったり 22回で おわる'),
  exact(39, 'サンキュー', 'ぴったり 39回で おわる'),
  anyStage('levelup-drop', 'レベルアップで きがぬけた', 'レベルが あがった ちょくごに おとす', (run) => run.kicks >= 10 && run.kicks % 10 === 0),

  // どのステージでも、たくさん
  anyStage('kicks-75', 'ちょうじん', 'どれかで 75回', (run) => run.kicks >= 75),
  anyStage('kicks-100', 'ひゃくれんぱつ', 'どれかで 100回', (run) => run.kicks >= 100),
  anyStage('kicks-150', 'リフティングキング', 'どれかで 150回', (run) => run.kicks >= 150),
  anyStage('kicks-200', 'かみの あし', 'どれかで 200回', (run) => run.kicks >= 200),

  // まんなかを蹴る
  anyStage('perfect-10', 'どまんなか', '1回の プレイで PERFECT 10回', (run) => run.perfects >= 10),
  anyStage('perfect-30', 'パーフェクト マシーン', '1回の プレイで PERFECT 30回', (run) => run.perfects >= 30),
  anyStage('streak-5', 'れんぞく パーフェクト', 'PERFECT を 5回 つづける', (run) => run.bestStreak >= 5),
  anyStage('no-perfect', 'ずれずれ', 'PERFECT なしで 20回', (run) => run.kicks >= 20 && run.perfects === 0),
  anyStage('walls-5', 'かべあて', '1回の プレイで かべに 5回 あてる', (run) => run.walls >= 5),

  // サッカーボール
  on('ball', 'wind-excuse', 'かぜの せいに する ひと', 'サッカーボールで 10〜14回', (run) => run.kicks >= 10 && run.kicks <= 14),
  on('ball', 'storm-60', 'ぼうふう けいほう', 'サッカーボールで 60回', (run) => run.kicks >= 60),
  on('ball', 'ball-walls', 'かぜに あそばれた', 'サッカーボールで かべに 8回 あてる', (run) => run.walls >= 8),

  // おにぎり
  on('onigiri', 'grains-half', 'はんぶん たべた', 'おにぎりの こめつぶを 1000つぶ いかに', (run) => run.grains <= 1000),
  on('onigiri', 'grains-min', 'ほぼ のり', 'おにぎりを いちばん ちいさく する', (run) => run.smallest),
  on('onigiri', 'onigiri-keep', 'おこめを たいせつに', 'おにぎりで 10回 けって 1500つぶ いじょう のこす', (run) => run.kicks >= 10 && run.grains >= 1500),
  anyStage('grains-3000', 'おちゃわん いっぱい', 'こめつぶを ぜんぶで 3000つぶ とばす', (run, t) => t.grainsLost >= 3000),

  // 生卵
  on('egg', 'egg-clean-10', 'ヒビなし', '生卵を ヒビ0のまま 10回', (run) => run.kicks >= 10 && run.cracks === 0),
  on('egg', 'egg-clean-30', 'むきずの たまご', '生卵を ヒビ0のまま 30回', (run) => run.kicks >= 30 && run.cracks === 0),
  on('egg', 'egg-edge', 'ぎりぎり たまご', '生卵を ヒビ3本で 20回', (run) => run.kicks >= 20 && run.cracks === 3 && !run.broken),
  on('egg', 'egg-broken', 'めだまやき', '生卵を わる', (run) => run.broken),
  on('egg', 'egg-quick', 'いきなり パカッ', '生卵を 5回 いないに わる', (run) => run.broken && run.kicks <= 5),
  on('egg', 'egg-ground', 'じめんで わった ひと', '生卵を じめんに おとす', (run) => !run.broken),
  anyStage('eggs-10', 'たまご 1パック', '生卵を ぜんぶで 10こ わる', (run, t) => t.eggsBroken >= 10),

  // すいか
  on('watermelon', 'seeds-30', 'たねまみれ', 'がめんに すいかの たねを 30こ', (run) => run.seeds >= 30),
  on('watermelon', 'seeds-80', 'まっくろ がめん', 'がめんに すいかの たねを 80こ', (run) => run.seeds >= 80),
  on('watermelon', 'melon-quick', 'いきなり スイカわり', 'すいかを 2回 いないで おとす', (run) => run.kicks <= 2),
  anyStage('seeds-1000', 'たね あつめ', 'すいかの たねを ぜんぶで 1000こ', (run, t) => t.seeds >= 1000),

  // スマホ
  on('phone', 'calls-5', 'ちゃくしん むし', '1回の プレイで でんわを 5回 むし', (run) => run.calls >= 5),
  on('phone', 'calls-15', 'でんわに でない ひと', '1回の プレイで でんわを 15回 むし', (run) => run.calls >= 15),
  on('phone', 'cracks-20', 'バキバキ がめん', 'スマホの ヒビ 20本', (run) => run.cracks >= 20),
  on('phone', 'cracks-50', 'もはや げんけい なし', 'スマホの ヒビ 50本', (run) => run.cracks >= 50),
  ...CALLER_TITLES.map(([caller, name]) =>
    on('phone', `caller-${caller}`, name, `「${caller}」から でんわが くる`, (run) => run.callers.includes(caller)),
  ),
  anyStage('calls-total-100', 'るすでん いっぱい', 'でんわを ぜんぶで 100回 むし', (run, t) => t.calls >= 100),

  // ぜんぶのステージ
  anyStage('all-played', 'ぜんぶ やってみた', 'ぜんぶの ステージで あそぶ', (run, t) => STAGES.every((s) => t.playsBy[s] > 0)),
  anyStage('all-15', 'オールラウンダー', 'ぜんぶの ステージで 15回', (run, t) => STAGES.every((s) => (t.best[s] ?? 0) >= 15)),
  anyStage('all-30', 'へんなもの マスター', 'ぜんぶの ステージで 30回', (run, t) => STAGES.every((s) => (t.best[s] ?? 0) >= 30)),
  anyStage('all-50', 'かんぜん せいは', 'ぜんぶの ステージで 50回', (run, t) => STAGES.every((s) => (t.best[s] ?? 0) >= 50)),

  // あそんだ回数
  anyStage('plays-1', 'はじめての リフティング', '1回 あそぶ', (run, t) => t.plays >= 1),
  anyStage('plays-10', 'じょうれん', 'ぜんぶで 10回 あそぶ', (run, t) => t.plays >= 10),
  anyStage('plays-50', 'リフティング ちゅうどく', 'ぜんぶで 50回 あそぶ', (run, t) => t.plays >= 50),
  anyStage('plays-100', 'まいにち リフティング', 'ぜんぶで 100回 あそぶ', (run, t) => t.plays >= 100),
  anyStage('plays-300', 'リフティングが じんせい', 'ぜんぶで 300回 あそぶ', (run, t) => t.plays >= 300),
  on('ball', 'ball-20', 'ボールは ともだち', 'サッカーボールで 20回 あそぶ', (run, t) => t.playsBy.ball >= 20),
  on('onigiri', 'onigiri-20', 'まいにち おにぎり', 'おにぎりで 20回 あそぶ', (run, t) => t.playsBy.onigiri >= 20),
  on('egg', 'egg-20', 'たまご かいすぎ', '生卵で 20回 あそぶ', (run, t) => t.playsBy.egg >= 20),
  on('watermelon', 'melon-20', 'なつが すき', 'すいかで 20回 あそぶ', (run, t) => t.playsBy.watermelon >= 20),
  on('phone', 'phone-20', 'スマホ いぞん', 'スマホで 20回 あそぶ', (run, t) => t.playsBy.phone >= 20),
  anyStage('same-5', 'あきらめない ひと', 'おなじ ステージを 5回 つづけて あそぶ', (run, t) => t.sameStageStreak >= 5),
  anyStage('same-20', 'しつこい ひと', 'おなじ ステージを 20回 つづけて あそぶ', (run, t) => t.sameStageStreak >= 20),

  // 蹴った回数の合計
  anyStage('total-100', 'ひゃっかい けった', 'ぜんぶで 100回 ける', (run, t) => t.kicks >= 100),
  anyStage('total-500', 'あしが ぼう', 'ぜんぶで 500回 ける', (run, t) => t.kicks >= 500),
  anyStage('total-1000', 'せんかい けり', 'ぜんぶで 1000回 ける', (run, t) => t.kicks >= 1000),
  anyStage('total-10000', 'いちまんかいの あし', 'ぜんぶで 10000回 ける', (run, t) => t.kicks >= 10000),

  // 自己ベスト
  anyStage('record-1', 'じこベスト こうしん', '5回 いじょうで 自己ベストを こうしん', (run) => run.isRecord && run.kicks >= 5),
  anyStage('record-10', 'きろく マニア', '自己ベストを ぜんぶで 10回 こうしん', (run, t) => t.records >= 10),
  anyStage('record-tie', 'ならびました', '自己ベストと おなじ回数（5回いじょう）', (run) => run.prevBest >= 5 && run.kicks === run.prevBest),
  anyStage('record-miss', 'おしい！', '自己ベストに あと1回（5回いじょう）', (run) => run.prevBest >= 6 && run.kicks === run.prevBest - 1),

  // そのほか
  anyStage('night', 'よふかし リフティング', 'よる 10じ〜あさ 4じに あそぶ', (run) => run.hour >= 22 || run.hour < 4),
  anyStage('morning', 'あさの じしゅれん', 'あさ 5じ〜8じに あそぶ', (run) => run.hour >= 5 && run.hour < 8),
  anyStage('muted', 'しずかに リフティング', 'おとを けして 10回', (run) => run.muted && run.kicks >= 10),
];

// 新しく取れたしょうごうの id を返す（have は取得済みの id の配列）
export function newTitles(run, totals, have = []) {
  const owned = new Set(have);
  return TITLES.filter((t) => !owned.has(t.id) && t.check(run, totals)).map((t) => t.id);
}

// これまでの合計に、今回のプレイを足したものを返す
export function addRun(totals, run) {
  const prev = totals ?? {};
  const playsBy = { ...(prev.playsBy ?? {}) };
  playsBy[run.stage] = (playsBy[run.stage] ?? 0) + 1;
  const best = { ...(prev.best ?? {}) };
  best[run.stage] = Math.max(best[run.stage] ?? 0, run.kicks);
  return {
    plays: (prev.plays ?? 0) + 1,
    kicks: (prev.kicks ?? 0) + run.kicks,
    playsBy,
    best,
    eggsBroken: (prev.eggsBroken ?? 0) + (run.stage === 'egg' && run.broken ? 1 : 0),
    grainsLost: (prev.grainsLost ?? 0) + (run.grainsLost ?? 0),
    seeds: (prev.seeds ?? 0) + (run.seeds ?? 0),
    calls: (prev.calls ?? 0) + (run.calls ?? 0),
    records: (prev.records ?? 0) + (run.isRecord && run.kicks > 0 ? 1 : 0),
    lastStage: run.stage,
    sameStageStreak: prev.lastStage === run.stage ? (prev.sameStageStreak ?? 1) + 1 : 1,
  };
}
