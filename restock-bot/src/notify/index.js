import { formatEvent } from './format.js';
import { sendDiscord } from './discord.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// イベントを、監視設定で指定された市場（jp / global）ごとに配信する。
// Webhook が未設定の市場や --dry-run のときはコンソールに出すだけにする。
export async function dispatch(events, env, { dryRun = false, log = console.log } = {}) {
  for (const event of events) {
    for (const market of event.watch.markets) {
      const payload = formatEvent(event, market, env);
      const webhook = env.webhooks[market];

      if (dryRun || !webhook) {
        log(renderForConsole(market, payload));
        continue;
      }
      try {
        await sendDiscord(webhook, payload);
      } catch (err) {
        log(`[${market}] ${err.message}`);
      }
      await sleep(500); // Webhook のレート制限に余裕を持たせる
    }
  }
}

export function renderForConsole(market, { content, embeds: [e] }) {
  const lines = [`[${market.toUpperCase()}] ${content}`, `  ${e.title}`];
  for (const f of e.fields) lines.push(`  ${f.name}: ${f.value}`);
  lines.push(`  ${e.url}`, `  ${e.footer.text}`);
  return lines.join('\n');
}
