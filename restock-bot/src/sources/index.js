import { fetchRakuten } from './rakuten.js';
import { fetchShopify } from './shopify.js';
import { fetchHtml } from './html.js';
import { fetchMock } from './mock.js';

const SOURCES = {
  rakuten: fetchRakuten,
  shopify: fetchShopify,
  html: fetchHtml,
  mock: fetchMock,
};

export async function fetchItems(watch, env, ctx) {
  const fn = SOURCES[watch.source];
  if (!fn) throw new Error(`未対応の source です: ${watch.source}`);
  return fn(watch, env, ctx);
}
