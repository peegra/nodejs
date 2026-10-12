import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  ROOT, build, expandShortcodes, findIssues, parseFrontMatter, renderAffiliates, renderReleases,
} from '../src/build.js';

const affiliates = [
  { id: 'h1', kind: 'hotel', partner: 'Booking.com', title: 'Hotel <A>', blurb: 'b', url: 'https://aff.example/h1' },
  { id: 'h2', kind: 'hotel', partner: 'Booking.com', title: 'Hotel B', blurb: 'b', url: '' },
  { id: 'e1', kind: 'esim', partner: 'Klook', title: 'eSIM', blurb: 'b', url: 'https://aff.example/e1' },
];

test('front matter を読み、本文と分ける', () => {
  const { meta, body } = parseFrontMatter('---\ntitle: Hello: world\norder: 2\n---\n# Body\n');
  assert.deepEqual(meta, { title: 'Hello: world', order: '2' });
  assert.equal(body, '# Body\n');
  assert.deepEqual(parseFrontMatter('no meta').meta, {});
});

test('アフィリエイト枠: 種類やIDで選び、広告リンクに sponsored を付け、未設定は無効表示', () => {
  const html = renderAffiliates({ kind: 'hotel' }, affiliates);
  assert.match(html, /href="https:\/\/aff\.example\/h1" rel="sponsored nofollow noopener"/);
  assert.match(html, /Hotel &lt;A&gt;/);
  assert.match(html, /aff-missing[\s\S]*Link not set yet/);
  assert.doesNotMatch(html, /eSIM/);
  assert.match(renderAffiliates({ ids: 'e1' }, affiliates), /eSIM/);
  assert.equal(renderAffiliates({ kind: 'tour' }, affiliates), '');
});

test('発売カレンダー: 日付順に並べ、過去の行を区別する', () => {
  const html = renderReleases(
    [
      { date: '2026-12-01', game: 'G', name: 'Later', msrpJpy: 6000 },
      { date: '2026-01-01', game: 'G', name: 'Earlier', msrpJpy: null, source: 'https://src' },
    ],
    { today: '2026-10-12' },
  );
  assert.ok(html.indexOf('Earlier') < html.indexOf('Later'));
  assert.match(html, /<tr class="past"><td>2026-01-01/);
  assert.match(html, /<a href="https:\/\/src">Earlier<\/a>/);
  assert.match(html, /¥6,000/);
  assert.match(html, /TBA/);
});

test('ショートコードと要確認の印を展開する', () => {
  const html = expandShortcodes('<p>{{affiliates kind=esim}}</p><p>x [[VERIFY: 店舗一覧]]</p>', { affiliates, releases: [] });
  assert.match(html, /^<div class="aff-grid">/);
  assert.match(html, /<mark class="verify"[^>]*>要確認: 店舗一覧<\/mark>/);
});

test('公開前チェック: 要確認・使っている枠の未設定リンク・仮のURLを拾う', () => {
  const pages = [{ file: 'content/a.md', meta: {}, source: 'x [[VERIFY: A]] {{affiliates kind=hotel}}' }];
  const issues = findIssues(pages, { affiliates, releases: [{ name: '[[VERIFY: B]]' }] }, { baseUrl: 'https://example.com' });
  assert.ok(issues.some((i) => i.includes('要確認 — A')));
  assert.ok(issues.some((i) => i.includes('要確認 — B')));
  assert.ok(issues.some((i) => i.includes('h2 のリンクが未設定')));
  assert.ok(!issues.some((i) => i.includes('e1'))); // 使っていない枠は対象外
  assert.ok(issues.some((i) => i.includes('description')));
  assert.ok(issues.some((i) => i.includes('example.com')));
});

test('サイト全体をビルドできる（全ページ・sitemap・広告表示）', () => {
  const out = mkdtempSync(path.join(tmpdir(), 'jcg-'));
  const { pages } = build({ root: ROOT, out });
  assert.ok(pages.length >= 5);
  for (const p of pages) assert.ok(existsSync(path.join(out, p.slug, 'index.html')), p.file);
  const where = readFileSync(path.join(out, 'where-to-buy-tokyo/index.html'), 'utf8');
  assert.match(where, /This page contains affiliate links/);
  assert.match(where, /<link rel="canonical"/);
  const about = readFileSync(path.join(out, 'about/index.html'), 'utf8');
  assert.doesNotMatch(about, /This page contains affiliate links/);
  assert.match(readFileSync(path.join(out, 'sitemap.xml'), 'utf8'), /<loc>https:\/\/example\.com\/buying-rules\/<\/loc>/);
});
