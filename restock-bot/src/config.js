import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MARKETS = ['jp', 'global'];
const EVENTS = ['restock', 'new', 'priceDrop'];

export function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (existsSync(envPath)) process.loadEnvFile(envPath);

  return {
    rakuten: {
      applicationId: process.env.RAKUTEN_APPLICATION_ID || '',
      affiliateId: process.env.RAKUTEN_AFFILIATE_ID || '',
      endpoint:
        process.env.RAKUTEN_ENDPOINT ||
        'https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601',
    },
    webhooks: {
      jp: process.env.DISCORD_WEBHOOK_JP || '',
      global: process.env.DISCORD_WEBHOOK_GLOBAL || '',
    },
    proxyUrlTemplate: process.env.PROXY_URL_TEMPLATE || '',
    jpyPerUsd: Number(process.env.JPY_PER_USD) || 0,
    pollIntervalSec: Number(process.env.POLL_INTERVAL_SEC) || 300,
  };
}

export function loadWatches(file) {
  const candidates = file
    ? [file]
    : [path.join(ROOT, 'config/watches.json'), path.join(ROOT, 'config/watches.example.json')];
  const found = candidates.find((f) => existsSync(f));
  if (!found) throw new Error(`監視設定ファイルが見つかりません: ${candidates.join(', ')}`);

  const watches = JSON.parse(readFileSync(found, 'utf8'));
  watches.forEach(validateWatch);
  return { file: found, watches };
}

export function validateWatch(w) {
  const where = `watch "${w.id ?? '(idなし)'}"`;
  if (!w.id) throw new Error(`${where}: id が必要です`);
  if (!w.source) throw new Error(`${where}: source が必要です`);
  if (!Array.isArray(w.markets) || w.markets.length === 0 || w.markets.some((m) => !MARKETS.includes(m))) {
    throw new Error(`${where}: markets は ${MARKETS.join(' / ')} の配列で指定してください`);
  }
  w.events ??= ['restock', 'new'];
  if (w.events.some((e) => !EVENTS.includes(e))) {
    throw new Error(`${where}: events は ${EVENTS.join(' / ')} から選んでください`);
  }
  w.label ??= {};
  w.label.ja ??= w.id;
  w.label.en ??= w.label.ja;
}
