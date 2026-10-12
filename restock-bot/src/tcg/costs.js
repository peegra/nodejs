// 日本で定価で買って海外に届けるまでの費用（1個あたり）を見積もる。
// 代行手数料・国内送料は1注文あたりの額を unitsPerOrder で割って1個分にする。
export function landedCost(product, costs) {
  const units = Math.max(1, costs.unitsPerOrder ?? 1);
  const jpy = {
    item: product.msrpJpy,
    proxyFee: (costs.proxyFeeJpy ?? 0) / units,
    domesticShipping: (costs.domesticShippingJpy ?? 0) / units,
  };
  const subtotalUsd = (jpy.item + jpy.proxyFee + jpy.domesticShipping) / costs.jpyPerUsd;
  const usd = {
    goods: subtotalUsd,
    paymentFee: subtotalUsd * pct(costs.paymentFeePct),
    intlShipping: costs.intlShippingUsdPerUnit ?? 0,
    duty: (jpy.item / costs.jpyPerUsd) * pct(costs.dutyPct), // 関税は商品代金にかかるものとして概算
  };
  const totalUsd = usd.goods + usd.paymentFee + usd.intlShipping + usd.duty;
  return { jpy, usd, totalUsd };
}

// 海外の相場で売った場合の手取り（販売手数料を引いた額）と、見積もり利益を出す。
export function evaluate(product, market, costs) {
  const cost = landedCost(product, costs);
  if (market?.priceUsd == null) return { product, cost, market, profitUsd: null, marginPct: null };
  const netUsd = market.priceUsd * (1 - pct(costs.sellingFeePct));
  const profitUsd = netUsd - cost.totalUsd;
  return { product, cost, market, netUsd, profitUsd, marginPct: (profitUsd / cost.totalUsd) * 100 };
}

export function rank(results) {
  return [...results].sort((a, b) => (b.profitUsd ?? -Infinity) - (a.profitUsd ?? -Infinity));
}

const pct = (v) => (Number(v) || 0) / 100;
