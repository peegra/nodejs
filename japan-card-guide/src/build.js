import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { layout, escapeHtml } from './layout.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 記事（content/*.md）をHTMLにして dist/ に書き出す。
// 記事の中では次の書き方が使える:
//   {{affiliates kind=hotel}} / {{affiliates ids=a,b}}  アフィリエイト枠
//   {{releases}}                                         発売カレンダーの表
//   [[VERIFY: メモ]]                                     公開前に事実確認が必要な箇所（--check で失敗する）

const VERIFY_RE = /\[\[VERIFY:\s*([^\]]*)\]\]/g;

export function parseFrontMatter(src) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(src);
  if (!m) return { meta: {}, body: src };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: src.slice(m[0].length) };
}

export function renderAffiliates(args, affiliates) {
  const ids = args.ids?.split(',').map((s) => s.trim());
  const picked = affiliates.filter((a) => (ids ? ids.includes(a.id) : a.kind === args.kind));
  if (picked.length === 0) return '';
  const cards = picked.map((a) => {
    const inner = `<span class="aff-kind">${escapeHtml(a.partner)}</span><strong>${escapeHtml(a.title)}</strong><span>${escapeHtml(a.blurb)}</span>`;
    // 広告リンクは検索エンジン向けに sponsored を付ける
    return a.url
      ? `<a class="aff-card" href="${escapeHtml(a.url)}" rel="sponsored nofollow noopener" target="_blank">${inner}<span class="aff-cta">Check prices →</span></a>`
      : `<div class="aff-card aff-missing">${inner}<span class="aff-cta">Link not set yet</span></div>`;
  });
  return `<div class="aff-grid">${cards.join('')}</div>`;
}

export function renderReleases(releases, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const rows = [...releases]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => {
      const price = r.msrpJpy ? `¥${r.msrpJpy.toLocaleString('en-US')}` : 'TBA';
      const name = r.source ? `<a href="${escapeHtml(r.source)}">${escapeHtml(r.name)}</a>` : escapeHtml(r.name);
      const cls = r.date < today ? ' class="past"' : '';
      return `<tr${cls}><td>${r.date}</td><td>${escapeHtml(r.game)}</td><td>${name}</td><td>${price}</td><td>${escapeHtml(r.note ?? '')}</td></tr>`;
    });
  return `<div class="table-wrap"><table class="releases"><thead><tr><th>JP release</th><th>Game</th><th>Product</th><th>JP retail</th><th>Notes</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}

export function expandShortcodes(html, data) {
  return html
    .replace(/(?:<p>)?\{\{\s*affiliates\s+([^}]*)\}\}(?:<\/p>)?/g, (_, argStr) => {
      const args = Object.fromEntries(argStr.trim().split(/\s+/).map((kv) => kv.split('=')));
      return renderAffiliates(args, data.affiliates);
    })
    .replace(/(?:<p>)?\{\{\s*releases\s*\}\}(?:<\/p>)?/g, () => renderReleases(data.releases))
    .replace(VERIFY_RE, (_, note) => `<mark class="verify" title="要確認">要確認: ${note}</mark>`);
}

// 公開前チェック: 事実確認が残っている箇所、未設定のアフィリエイトリンク、仮のサイトURLを洗い出す。
export function findIssues(pages, data, site) {
  const issues = [];
  for (const p of pages) {
    for (const m of p.source.matchAll(VERIFY_RE)) issues.push(`${p.file}: 要確認 — ${m[1]}`);
    if (!p.meta.description) issues.push(`${p.file}: description（検索結果に出る説明文）がありません`);
  }
  for (const r of data.releases) {
    for (const m of JSON.stringify(r).matchAll(VERIFY_RE)) issues.push(`data/releases.json: 要確認 — ${m[1]}`);
  }
  const used = new Set(pages.flatMap((p) => [...p.source.matchAll(/\{\{\s*affiliates\s+([^}]*)\}\}/g)].map((m) => m[1])));
  for (const a of data.affiliates) {
    const isUsed = [...used].some((u) => u.includes(`kind=${a.kind}`) || u.split('ids=')[1]?.split(',').includes(a.id));
    if (isUsed && !a.url) issues.push(`data/affiliates.json: ${a.id} のリンクが未設定です`);
  }
  if (/example\.com/.test(site.baseUrl)) issues.push('site.config.json: baseUrl が仮の値（example.com）のままです');
  return issues;
}

export function loadAll(root = ROOT) {
  const site = JSON.parse(readFileSync(path.join(root, 'site.config.json'), 'utf8'));
  const data = {
    affiliates: JSON.parse(readFileSync(path.join(root, 'data/affiliates.json'), 'utf8')),
    releases: JSON.parse(readFileSync(path.join(root, 'data/releases.json'), 'utf8')),
  };
  const dir = path.join(root, 'content');
  const pages = readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const source = readFileSync(path.join(dir, file), 'utf8');
      const { meta, body } = parseFrontMatter(source);
      const slug = meta.slug ?? file.replace(/\.md$/, '');
      return { file: `content/${file}`, source, meta, body, slug: slug === 'index' ? '' : slug };
    })
    .sort((a, b) => Number(a.meta.order ?? 99) - Number(b.meta.order ?? 99));
  return { site, data, pages };
}

export function build({ root = ROOT, out = path.join(root, 'dist') } = {}) {
  const { site, data, pages } = loadAll(root);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  const nav = pages.filter((p) => p.meta.nav).map((p) => ({ href: `/${p.slug}${p.slug ? '/' : ''}`, label: p.meta.nav }));
  for (const p of pages) {
    const content = expandShortcodes(marked.parse(p.body), data);
    const html = layout({ site, page: p, content, nav, hasAffiliates: /\{\{\s*affiliates/.test(p.body) });
    const dir = path.join(out, p.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'index.html'), html);
  }

  const base = site.baseUrl.replace(/\/+$/, '');
  const urls = pages.map((p) => `  <url><loc>${base}/${p.slug}${p.slug ? '/' : ''}</loc>${p.meta.updated ? `<lastmod>${p.meta.updated}</lastmod>` : ''}</url>`);
  writeFileSync(path.join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
  writeFileSync(path.join(out, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
  if (existsSync(path.join(root, 'assets'))) cpSync(path.join(root, 'assets'), path.join(out, 'assets'), { recursive: true });

  return { pages, issues: findIssues(pages, data, site) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const check = process.argv.includes('--check');
  const { pages, issues } = build();
  console.log(`${pages.length} ページを dist/ に書き出しました`);
  if (issues.length) {
    console.log(`\n公開前に確認が必要な項目（${issues.length}件）:`);
    for (const i of issues) console.log(`  - ${i}`);
    if (check) process.exitCode = 1;
  } else {
    console.log('公開前チェック: 問題なし');
  }
}
