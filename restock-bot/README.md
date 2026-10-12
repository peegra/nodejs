# restock-bot（試作）

品薄商品の **再入荷・新着・値下がり** を監視して、2つの市場に同時配信するボットです。

| 市場 | 言語 | 配信先 | 収益化 |
|---|---|---|---|
| `jp` | 日本語 | Discord（無料チャンネル） | 楽天アフィリエイトのリンク（PR表記つき） |
| `global` | 英語 | Discord（有料ロール限定チャンネルを想定） | 有料Discord＋購入代行サービス経由のリンク |

ジャンルは `category` で分けます（いまは `soccer` と `anime`）。外部ライブラリなし、Node.js 22 以上で動きます。

## まず動かしてみる（APIキー不要）

```bash
cd restock-bot
npm run demo   # デモ用データで3回監視して、通知の文面をコンソールに出す
npm test       # 単体テスト
```

## 本番の設定

1. `.env.example` を `.env` にコピーして、値を入れます
   - `RAKUTEN_APPLICATION_ID` / `RAKUTEN_AFFILIATE_ID`: [楽天ウェブサービス](https://webservice.rakuten.co.jp/) で取得します
   - `DISCORD_WEBHOOK_JP` / `DISCORD_WEBHOOK_GLOBAL`: Discord のチャンネル設定 →「連携サービス」→「ウェブフック」で作成します。未設定の市場はコンソールに出すだけになります
   - `PROXY_URL_TEMPLATE`: 海外向けリンクに使う購入代行サービスのURL。`{url}` が商品URLに置き換わります
2. `config/watches.example.json` を `config/watches.json` にコピーして、監視する商品を書きます
3. 実行します

```bash
npm run once            # 1回だけ監視する
npm start               # POLL_INTERVAL_SEC ごとに監視し続ける
node src/index.js --once --dry-run   # Discordには送らず、コンソールに出す
```

初回の監視は現在の状態を記録するだけで、通知は出しません（全商品が「新着」扱いになるのを防ぐため）。

## 監視設定（`config/watches.json`）

```jsonc
{
  "id": "jp-national-team-limited",      // 一意なID（状態の保存に使う）
  "category": "soccer",                   // soccer / anime（通知の見出しに使う）
  "markets": ["jp", "global"],            // どちらの市場に配信するか
  "label": { "ja": "日本代表 限定ユニ", "en": "Japan NT limited jersey" },
  "source": "rakuten",                    // rakuten / shopify / html
  "query": { "keyword": "サッカー日本代表 ユニフォーム 限定", "minPrice": 8000 },
  "variants": ["M", "L"],                 // shopify のみ: 監視するサイズ
  "events": ["restock", "new", "priceDrop"]
}
```

### source ごとの違い

| source | 取得方法 | サイズ別の在庫 | 向いている対象 |
|---|---|---|---|
| `rakuten` | 楽天市場商品検索API | ×（商品単位のみ） | サッカーショップ、ホビーショップの楽天店 |
| `shopify` | ストアの `/products.json` | ○ | Shopify で作られたクラブ公式・アニメ公式の通販 |
| `html` | ページ内の文言で判定 | × | APIのない公式通販の単品ページ |

`query` の項目:
- `rakuten`: `keyword`、`minPrice`、`maxPrice`、`genreId`、`shopCode`、`hits`、`sort`
- `shopify`: `store`（ストアのURL）、`handle`（単品）または `keyword`（一覧から絞り込み）
- `html`: `url`、`title`、`inStock`（在庫ありの文言・正規表現）、`outOfStock`（在庫なしの文言・正規表現）

## 構成

```
src/
  index.js          監視ループ（--once / --demo / --dry-run）
  config.js         .env と監視設定の読み込み
  state.js          前回の在庫状態を data/state.json に保存
  detect.js         前回との差分から restock / new / priceDrop を判定
  sources/          rakuten / shopify / html / mock（デモ）
  notify/format.js  市場ごとの文面（日本語＋PR表記 / 英語＋代行リンク）
  notify/discord.js Discord Webhook への送信（429 のときは待って再送）
```

## 運用上の注意

- **利用規約とアクセス頻度**: 楽天APIは1秒1回までにしています。`shopify` と `html` は相手のサイトの規約と robots.txt を確認し、監視間隔を短くしすぎないでください
- **PR表記**: 日本向けの通知にはステマ規制に対応した「PR」表記を入れています。消さないでください
- **扱わないもの**: チケットなど、法律で転売が規制されている商品は監視対象にしないでください
- **楽天APIの仕様**: エンドポイントは `RAKUTEN_ENDPOINT` で差し替えられます。仕様が変わったときは公式ドキュメントを確認してください

## 次にやること

- [ ] 監視する実在のショップと商品を選ぶ（サッカー・アニメそれぞれ5〜10件）
- [ ] 海外向けの商品名を英訳する（今は日本語のまま）
- [ ] 有料ロールの販売（Stripe や Discord の有料サブスク機能、Whop など）
- [ ] 登録者が自分でサイズや選手を選べる機能（スラッシュコマンド）
- [ ] 常時稼働の置き場所（小さなVPS、Cloud Run＋スケジューラなど）
