import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MARKETS = ['jp', 'global'];
// ジャンル名に使えない名前（配信先の名前と重なるため）
const RESERVED_CATEGORIES = ['jp', 'global', 'free', 'status'];
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
      // DISCORD_WEBHOOK_SOCCER / _ANIME / _IDOL など、ジャンル名ごとの配信先をすべて読み込む
      ...categoryWebhooks(process.env),
      jp: process.env.DISCORD_WEBHOOK_JP || '',
      // ジャンル別の配信先がないときは GLOBAL にまとめて送る
      global: process.env.DISCORD_WEBHOOK_GLOBAL || '',
      free: process.env.DISCORD_WEBHOOK_FREE || '',
      status: process.env.DISCORD_WEBHOOK_STATUS || '',
    },
    freeDelayMin: Number(process.env.FREE_DELAY_MIN ?? 30),
    joinUrl: process.env.JOIN_URL || '',
    failureThreshold: Number(process.env.FAILURE_THRESHOLD) || 3,
    proxyUrlTemplate: process.env.PROXY_URL_TEMPLATE || '',
    jpyPerUsd: Number(process.env.JPY_PER_USD) || 0,
    pollIntervalSec: Number(process.env.POLL_INTERVAL_SEC) || 300,
  };
}

export function categoryWebhooks(vars) {
  const out = {};
  for (const [key, value] of Object.entries(vars)) {
    const m = /^DISCORD_WEBHOOK_([A-Z0-9_]+)$/.exec(key);
    if (m && value) out[m[1].toLowerCase()] = value;
  }
  return out;
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
  if (!w.category || RESERVED_CATEGORIES.includes(w.category)) {
    throw new Error(`${where}: category が必要です（${RESERVED_CATEGORIES.join(' / ')} は使えません）`);
  }
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
