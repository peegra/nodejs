// 通知の文面を市場ごとに作る。
//   jp     : 日本語。アフィリエイトリンク＋PR表記（ステマ規制対応）
//   global : 英語。購入代行サービス経由のリンク（日本国内発送のみの店舗が多いため）

const COLORS = { restock: 0x2ecc71, new: 0x3498db, priceDrop: 0xe67e22 };

const TEXT = {
  jp: {
    restock: '🔔 再入荷',
    new: '🆕 新着',
    priceDrop: '💸 値下がり',
    category: { soccer: '⚽ サッカー', anime: '🎌 アニメ', idol: '🎤 アイドル' },
    price: '価格',
    size: 'サイズ',
    shop: 'ショップ',
    footer: 'PR｜この通知にはアフィリエイトリンクが含まれます。在庫・価格は通知時点のものです。',
  },
  global: {
    restock: '🔔 RESTOCK',
    new: '🆕 NEW DROP',
    priceDrop: '💸 PRICE DROP',
    category: { soccer: '⚽ Football', anime: '🎌 Anime', idol: '🎤 Idol' },
    price: 'Price',
    size: 'Size',
    shop: 'Shop',
    footer:
      'Ships from Japan — use a proxy/forwarding service if the shop does not ship overseas. Links may be affiliate links. Stock and price as of alert time.',
  },
};

export function buildLink(item, market, env) {
  if (market === 'jp') return item.affiliateUrl || item.url;
  if (env.proxyUrlTemplate) return env.proxyUrlTemplate.replace('{url}', encodeURIComponent(item.url));
  return item.url;
}

export function formatPrice(item, market, env) {
  if (item.price == null) return null;
  const yen = `¥${Math.round(item.price).toLocaleString('en-US')}`;
  if (market === 'global' && env.jpyPerUsd) {
    return `${yen} (≈ $${Math.round(item.price / env.jpyPerUsd).toLocaleString('en-US')})`;
  }
  return yen;
}

// free: 無料チャンネル向け。遅れて届くことと、有料会員の申し込み先を添える
export function formatEvent(event, market, env, { free = false } = {}) {
  const t = TEXT[market];
  const { watch, item } = event;
  const label = market === 'jp' ? watch.label.ja : watch.label.en;

  const fields = [];
  const price = formatPrice(item, market, env);
  if (price) {
    const before =
      event.type === 'priceDrop' ? `~~${formatPrice({ price: event.previousPrice }, market, env)}~~ → ` : '';
    fields.push({ name: t.price, value: `${before}${price}`, inline: true });
  }
  if (item.variant) fields.push({ name: t.size, value: item.variant, inline: true });
  if (item.shop) fields.push({ name: t.shop, value: item.shop, inline: true });

  const head = `${t[event.type]}｜${t.category[watch.category] ?? watch.category}｜${label}`;
  const footer = free ? `${freeNote(env)} ${t.footer}` : t.footer;

  return {
    content: free ? `⏱ ${head}` : head,
    embeds: [
      {
        title: truncate(item.title, 256),
        url: buildLink(item, market, env),
        color: COLORS[event.type],
        fields,
        // showImage: false の監視では商品画像を載せない（本人が写った写真集の表紙など）
        thumbnail: item.image && watch.showImage !== false ? { url: item.image } : undefined,
        footer: { text: footer },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

function freeNote(env) {
  const early = `Members got this alert ${env.freeDelayMin} min earlier`;
  return env.joinUrl ? `${early} — join: ${env.joinUrl}.` : `${early}.`;
}

function truncate(s, n) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
