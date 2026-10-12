// 損益計算の結果を、海外向け（英語）の Discord メッセージと、確認用のコンソール表にする。
const usd = (n) => `$${n.toFixed(2)}`;
const sign = (n) => (n >= 0 ? '+' : '−');
const signedUsd = (n) => `${sign(n)}$${Math.abs(n).toFixed(2)}`;
const signedPct = (n, digits = 0) => `${sign(n)}${Math.abs(n).toFixed(digits)}%`;
const STALE_DAYS = 7;

export function formatReport(results, costs, { now = Date.now(), maxRows = 10 } = {}) {
  const rows = results.slice(0, maxRows);
  const fields = rows.map((r) => ({ name: rowTitle(r), value: rowValue(r, now) }));
  const best = rows.find((r) => r.profitUsd != null);

  return {
    content: '🇯🇵 → 🌍 **Japanese sealed product import calculator**',
    embeds: [
      {
        title: 'Buy at Japanese retail price, sell at US market — estimated profit per unit',
        description: assumptions(costs),
        color: best && best.profitUsd > 0 ? 0x2ecc71 : 0x95a5a6,
        fields,
        footer: {
          text: 'Estimates only. Retail availability in Japan is limited (lotteries, purchase limits), and fees, FX and prices change. Not financial advice.',
        },
        timestamp: new Date(now).toISOString(),
      },
    ],
  };
}

function rowTitle(r) {
  const icon = r.profitUsd == null ? '⏳' : r.profitUsd > 0 ? '🟢' : '🔴';
  const release = r.product.releaseDate ? ` — JP release ${r.product.releaseDate}` : '';
  return `${icon} ${r.product.name.en}${release}`;
}

function rowValue(r, now) {
  const retail = `JP retail ¥${r.product.msrpJpy.toLocaleString('en-US')} → landed ${usd(r.cost.totalUsd)}`;
  if (r.profitUsd == null) return `${retail}\nNo US market price yet`;

  const trend = r.market.change7dPct != null ? ` (7d ${signedPct(r.market.change7dPct, 1)})` : '';
  const stale =
    r.market.lastUpdated && now - Date.parse(r.market.lastUpdated) > STALE_DAYS * 86_400_000 ? ' ⚠️ price data is old' : '';
  return `${retail}\nUS market ${usd(r.market.priceUsd)}${trend}${stale}\nEst. profit **${signedUsd(r.profitUsd)} (${signedPct(r.marginPct)})**`;
}

function assumptions(c) {
  return [
    `FX ¥${c.jpyPerUsd}/$`,
    `proxy+JP shipping ¥${(c.proxyFeeJpy ?? 0) + (c.domesticShippingJpy ?? 0)} per order of ${c.unitsPerOrder ?? 1}`,
    `int'l shipping ${usd(c.intlShippingUsdPerUnit ?? 0)}/unit`,
    `duty ${c.dutyPct ?? 0}%`,
    `selling fees ${c.sellingFeePct ?? 0}%`,
  ].join(' · ');
}

export function renderTable(results) {
  const lines = ['商品 | 定価 | 着地コスト | 米国相場 | 見積もり利益'];
  for (const r of results) {
    const market = r.market?.priceUsd != null ? usd(r.market.priceUsd) : '相場なし';
    const profit = r.profitUsd != null ? `${signedUsd(r.profitUsd)} (${signedPct(r.marginPct)})` : '-';
    lines.push(`${r.product.name.ja} | ¥${r.product.msrpJpy.toLocaleString('ja-JP')} | ${usd(r.cost.totalUsd)} | ${market} | ${profit}`);
  }
  return lines.join('\n');
}
