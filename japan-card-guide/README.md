# japan-card-guide（試作）

海外からの旅行者向けの英語ガイドサイト **「Japan Card Hunt」** です。日本でポケモンカードを探す旅を計画する人に、購入ルール、東京で買える場所、新弾の発売カレンダー、1日の回り方を案内します。収益はホテル・ツアー・eSIM などの **旅行アフィリエイト** です。

- 店舗ごとの入荷情報は扱いません（店への迷惑、外れたときの信用低下、Xの規約の問題があるため）
- 記事は Markdown で書き、ビルドすると静的な HTML になります。GitHub Pages や Cloudflare Pages で無料公開できます

## 使い方

```bash
cd japan-card-guide
npm install
npm run build     # dist/ に書き出す（公開前に確認が必要な項目も表示）
npm run preview   # ビルドして http://localhost:4173 で確認
npm run check     # 公開前チェック。確認が必要な項目が残っていると失敗する
npm test
```

## 記事の書き方（`content/*.md`）

```markdown
---
title: ページのタイトル
nav: メニューに出す名前（省略するとメニューに出ない）
description: 検索結果に出る説明文（必須）
order: 並び順
updated: 最終確認日（2026-10-12 の形式）
---

# 見出し

本文…

{{affiliates kind=hotel}}            ← アフィリエイト枠（種類で指定）
{{affiliates ids=esim-japan}}        ← アフィリエイト枠（IDで指定）
{{releases}}                         ← 発売カレンダーの表（data/releases.json）
[[VERIFY: 確認したいこと]]            ← 公開前に事実確認が必要な箇所（黄色で表示され、check で失敗する）
```

アフィリエイト枠を使うページには、「広告リンクを含む」という表示が自動で入ります。広告リンクには `rel="sponsored"` が付きます。

## データ

| ファイル | 内容 |
|---|---|
| `site.config.json` | サイト名、公開URL（`baseUrl`）など |
| `data/affiliates.json` | アフィリエイト枠。各社の紹介プログラムに登録して取得したリンクを `url` に入れる |
| `data/releases.json` | 発売カレンダー（日付、ゲーム、商品名、定価、出典URL） |

## 公開までにやること

`npm run check` が通るまで、次を片付けます。

1. **事実確認**: 記事内の `[[VERIFY: …]]`（現在14件）を一つずつ確認し、本文を直して印を消す
2. **アフィリエイトの登録**: Booking.com、GetYourGuide、Klook などの紹介プログラムに登録し、リンクを `data/affiliates.json` に入れる（報酬率や条件は各社のページで確認）
3. **ドメインと公開先**: ドメインを取り、`site.config.json` の `baseUrl` を書き換えて、Cloudflare Pages などで公開する
4. **検索エンジンへの登録**: Google Search Console にサイトと `sitemap.xml` を登録する

## 今後の記事の候補

- 大阪・京都で探す場合のガイド
- 日本語版と英語版のカードの違い（旅行者がよく迷う点）
- 免税で買うときの手順（2026年の制度変更をふまえて）
- カードショップで使える日本語フレーズ集
