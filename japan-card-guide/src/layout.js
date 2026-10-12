export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// 全ページ共通のHTML。検索エンジン向けの情報（canonical、OGP、構造化データ）もここで入れる。
export function layout({ site, page, content, nav, hasAffiliates }) {
  const base = site.baseUrl.replace(/\/+$/, '');
  const url = `${base}/${page.slug}${page.slug ? '/' : ''}`;
  const title = page.slug ? `${page.meta.title} | ${site.name}` : `${site.name} — ${site.tagline}`;
  const description = page.meta.description ?? site.tagline;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': page.slug ? 'Article' : 'WebSite',
    headline: page.meta.title ?? site.name,
    description,
    url,
    ...(page.meta.updated ? { dateModified: page.meta.updated } : {}),
  };

  return `<!doctype html>
<html lang="${site.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="${page.slug ? 'article' : 'website'}">
<meta property="og:title" content="${escapeHtml(page.meta.title ?? site.name)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="${escapeHtml(site.name)}">
<link rel="stylesheet" href="/assets/style.css">
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
</head>
<body>
<header class="site-header">
  <a class="brand" href="/">${escapeHtml(site.name)}</a>
  <nav>${nav.map((n) => `<a href="${n.href}">${escapeHtml(n.label)}</a>`).join('')}</nav>
</header>
<main>
${hasAffiliates ? '<p class="disclosure">This page contains affiliate links. If you book through them we may earn a commission, at no extra cost to you. <a href="/disclosure/">Learn more</a>.</p>' : ''}
<article>
${content}
</article>
${page.meta.updated ? `<p class="updated">Last checked: ${escapeHtml(page.meta.updated)}. Rules and stock change often — always follow in-store notices.</p>` : ''}
</main>
<footer class="site-footer">
  <a href="/disclosure/">Affiliate disclosure</a>
  <a href="/about/">About</a>
  <span>Not affiliated with The Pokémon Company, Nintendo, or any retailer.</span>
</footer>
</body>
</html>
`;
}
