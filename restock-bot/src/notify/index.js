import { formatEvent } from './format.js';
import { sendDiscord } from './discord.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 配信先を決める。海外向けはジャンル別のチャンネル、なければ GLOBAL にまとめる。
export function targetFor(event, market, env) {
  if (market === 'jp') return { name: 'jp', url: env.webhooks.jp };
  const category = event.watch.category;
  return { name: `global:${category}`, url: env.webhooks[category] || env.webhooks.global };
}

// Webhook が未設定のときや --dry-run のときはコンソールに出すだけにする。
export async function deliver(target, payload, { dryRun = false, log = console.log } = {}) {
  if (dryRun || !target.url) {
    log(renderForConsole(target.name, payload));
    return;
  }
  try {
    await sendDiscord(target.url, payload);
  } catch (err) {
    log(`[${target.name}] ${err.message}`);
  }
  await sleep(500); // Webhook のレート制限に余裕を持たせる
}

// イベントを市場ごとに配信する。海外向けは無料チャンネル用の遅延配信も予約する。
export async function dispatch(events, env, state, { dryRun = false, log = console.log, now = Date.now() } = {}) {
  for (const event of events) {
    for (const market of event.watch.markets) {
      await deliver(targetFor(event, market, env), formatEvent(event, market, env), { dryRun, log });

      if (market === 'global' && env.webhooks.free) {
        state.freeQueue ??= [];
        state.freeQueue.push({
          dueAt: now + env.freeDelayMin * 60_000,
          payload: formatEvent(event, market, env, { free: true }),
        });
      }
    }
  }
}

// 予定時刻を過ぎた無料チャンネル向けの通知を送る。キューは state に保存されるので再起動しても消えない。
export async function flushFreeQueue(env, state, { dryRun = false, log = console.log, now = Date.now() } = {}) {
  const queue = state.freeQueue ?? [];
  const due = queue.filter((q) => q.dueAt <= now);
  state.freeQueue = queue.filter((q) => q.dueAt > now);
  for (const q of due) {
    await deliver({ name: 'free', url: env.webhooks.free }, q.payload, { dryRun, log });
  }
  return due.length;
}

export function renderForConsole(name, { content, embeds }) {
  const lines = [`[${name.toUpperCase()}] ${content}`];
  for (const e of embeds ?? []) {
    lines.push(`  ${e.title}`);
    for (const f of e.fields ?? []) lines.push(`  ${f.name}: ${f.value.replaceAll('\n', '\n    ')}`);
    if (e.url) lines.push(`  ${e.url}`);
    if (e.footer) lines.push(`  ${e.footer.text}`);
  }
  return lines.join('\n');
}
