// 監視ごとの成否を記録し、失敗が続いたとき・復旧したときに管理者向けのメッセージを返す。
// 取得件数が0件のときも失敗として数える（サイトの作りが変わって何も取れなくなった可能性が高いため）。
export function updateHealth(state, watch, { error = null, itemCount = 0 }, { threshold = 3, now = new Date().toISOString() } = {}) {
  state.health ??= {};
  const h = (state.health[watch.id] ??= { failures: 0, alerted: false });
  const problem = error ? error : itemCount === 0 ? '商品が0件でした（ページの作りが変わった可能性があります）' : null;

  if (!problem) {
    const recovered = h.alerted;
    state.health[watch.id] = { failures: 0, alerted: false, lastOk: now };
    return recovered ? `✅ 復旧: ${watch.id}` : null;
  }

  h.failures += 1;
  h.lastError = problem;
  h.lastErrorAt = now;
  if (h.failures >= threshold && !h.alerted) {
    h.alerted = true;
    return `⚠️ 監視が${h.failures}回続けて失敗しています: ${watch.id}\n${problem}`;
  }
  return null;
}
