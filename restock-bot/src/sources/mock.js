// APIキーなしで動作を確認するためのデモ用データ。
// 実行するたびに在庫や商品が変わり、再入荷・新着・値下がりが順番に発生する。
const SCENARIO = {
  soccer: [
    [
      item('jersey-26-home', 'サッカー日本代表 2026 ホーム オーセンティック', 'L', 16500, false),
      item('jersey-26-home-xl', 'サッカー日本代表 2026 ホーム オーセンティック', 'XL', 16500, true),
    ],
    [
      item('jersey-26-home', 'サッカー日本代表 2026 ホーム オーセンティック', 'L', 16500, true),
      item('jersey-26-home-xl', 'サッカー日本代表 2026 ホーム オーセンティック', 'XL', 16500, true),
      item('jersey-anniv', 'Jクラブ 30周年記念 限定ユニフォーム', 'M', 13200, true),
    ],
    [
      item('jersey-26-home', 'サッカー日本代表 2026 ホーム オーセンティック', 'L', 14000, true),
      item('jersey-26-home-xl', 'サッカー日本代表 2026 ホーム オーセンティック', 'XL', 16500, false),
      item('jersey-anniv', 'Jクラブ 30周年記念 限定ユニフォーム', 'M', 13200, true),
    ],
  ],
  anime: [
    [item('fig-limited', '【日本限定】1/7スケール フィギュア 限定版', null, 24800, false)],
    [
      item('fig-limited', '【日本限定】1/7スケール フィギュア 限定版', null, 24800, true),
      item('card-box', 'トレーディングカード 拡張パック 日本語版 BOX', null, 5400, true),
    ],
    [
      item('fig-limited', '【日本限定】1/7スケール フィギュア 限定版', null, 24800, true),
      item('card-box', 'トレーディングカード 拡張パック 日本語版 BOX', null, 5400, false),
    ],
  ],
};

export function fetchMock(watch, _env, { round = 0 } = {}) {
  const steps = SCENARIO[watch.category] ?? SCENARIO.soccer;
  return steps[Math.min(round, steps.length - 1)];
}

function item(id, title, variant, price, available) {
  return {
    id: variant ? `${id}:${variant}` : id,
    title,
    variant,
    price,
    currency: 'JPY',
    available,
    url: `https://example.com/items/${id}`,
    affiliateUrl: `https://example.com/items/${id}?aff=demo`,
    image: null,
    shop: 'demo-shop',
  };
}
