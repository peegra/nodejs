// 前回の状態と今回取得した商品を比べて、通知すべきイベントを返す。
//   restock   : 在庫なし → あり
//   new       : 初めて見る商品が在庫ありで出てきた（初回の取得では通知しない）
//   priceDrop : 在庫ありのまま、指定割合以上値下がりした
export function detectChanges(watch, prev, items, { now = new Date().toISOString(), priceDropPct = 10 } = {}) {
  const seeded = Boolean(prev?.seeded);
  const prevItems = prev?.items ?? {};
  const nextItems = { ...prevItems };
  const events = [];

  for (const item of items) {
    const before = prevItems[item.id];

    if (!before) {
      if (seeded && item.available && watch.events.includes('new')) {
        events.push({ type: 'new', watch, item });
      }
    } else if (!before.available && item.available) {
      if (watch.events.includes('restock')) events.push({ type: 'restock', watch, item });
    } else if (
      before.available &&
      item.available &&
      watch.events.includes('priceDrop') &&
      before.price > 0 &&
      item.price > 0 &&
      (before.price - item.price) / before.price >= priceDropPct / 100
    ) {
      events.push({ type: 'priceDrop', watch, item, previousPrice: before.price });
    }

    nextItems[item.id] = {
      available: item.available,
      price: item.price,
      title: item.title,
      lastSeen: now,
      lastChange: before && before.available === item.available ? before.lastChange : now,
    };
  }

  return { events, next: { seeded: true, items: nextItems } };
}
