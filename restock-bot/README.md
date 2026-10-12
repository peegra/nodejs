# restock-bot（試作）

日本限定品（サッカー・アニメ）の **再入荷・新着・値下がり** を監視して、海外のファン向けに英語で Discord に通知するボットです。会話のない **配信専用サービス** として、運営の手間をかけずに回すことを前提にしています。

```
監視（楽天・Shopifyストア・公式通販）
  → 差分を検知（再入荷 / 新着 / 値下がり）
  → 有料チャンネルにすぐ通知（サッカー・アニメ別）
  → 無料チャンネルに30分遅れで同じ通知（「有料なら30分早い」という宣伝）
  → 監視が失敗し続けたら、管理用チャンネルに自分宛ての警告
```

外部ライブラリなし、Node.js 22 以上で動きます。日本向け（日本語＋楽天アフィリエイト）の配信機能も残っていますが、現在は休止中です。

## まず動かしてみる（APIキー不要）

```bash
cd restock-bot
npm run demo   # デモ用データで3回監視し、通知の文面をコンソールに出す
npm test       # 単体テスト
```

デモでは、有料チャンネル（`GLOBAL:SOCCER` / `GLOBAL:ANIME`）、無料チャンネル（`FREE`）、管理用チャンネル（`STATUS`）に届く内容が表示されます。

## Discord サーバーの作り方（配信専用）

1. Discord の「サーバーを追加」→「オリジナルの作成」でサーバーを作る
2. 次のチャンネルを作る

   | チャンネル | 見られる人 | 書き込み |
   |---|---|---|
   | `#welcome`（説明・FAQ） | 全員 | 不可 |
   | `#free-alerts` | 全員 | 不可 |
   | `#football-alerts` | 有料ロールのみ | 不可 |
   | `#anime-alerts` | 有料ロールのみ | 不可 |
   | `#bot-status` | 自分のみ | 不可 |

   - チャンネルの設定 →「権限」で `@everyone` の「メッセージを送信」をオフにすると、書き込めない配信専用チャンネルになります
   - 有料チャンネルは「プライベートチャンネル」にして、有料ロール（例: `Member`）だけが見られるようにします
3. 各チャンネルの設定 →「連携サービス」→「ウェブフック」で URL を作り、`.env` に貼る
4. 有料ロールの販売は Whop などに任せる（決済すると自動でロールが付き、解約すると外れます）

## 設定

1. `.env.example` を `.env` にコピーして値を入れる

   | 項目 | 内容 |
   |---|---|
   | `DISCORD_WEBHOOK_SOCCER` / `DISCORD_WEBHOOK_ANIME` | 有料チャンネル（ジャンル別）。作らない場合は `DISCORD_WEBHOOK_GLOBAL` に1つだけ |
   | `DISCORD_WEBHOOK_FREE` / `FREE_DELAY_MIN` | 無料チャンネルと遅延（分）。未設定なら無料チャンネルには送らない |
   | `JOIN_URL` | 無料チャンネルの通知に載せる有料会員の申し込みページ |
   | `DISCORD_WEBHOOK_STATUS` / `FAILURE_THRESHOLD` | 管理用チャンネルと、何回続けて失敗したら知らせるか |
   | `PROXY_URL_TEMPLATE` | 購入代行サービスのURL。`{url}` が商品URLに置き換わる |
   | `JPY_PER_USD` | ドル換算の目安を出すときのレート |
   | `RAKUTEN_APPLICATION_ID` | 楽天を監視する場合のみ |

   Webhook が未設定のチャンネルは、送らずにコンソールに出すだけになります。

2. `config/watches.example.json` を `config/watches.json` にコピーして、監視する商品を書く
3. 実行する

```bash
npm run once                          # 1回だけ監視
npm start                             # POLL_INTERVAL_SEC ごとに監視し続ける
node src/index.js --once --dry-run    # Discordには送らずコンソールに出す
```

初回の監視は現在の状態を記録するだけで、通知は出しません（全商品が「新着」扱いになるのを防ぐため）。

## 監視設定（`config/watches.json`）

```jsonc
{
  "id": "jclub-store-uniforms",           // 一意なID（状態の保存に使う）
  "category": "soccer",                   // soccer / anime（配信チャンネルの振り分けに使う）
  "markets": ["global"],                  // global（海外向け）/ jp（日本向け・休止中）
  "label": { "en": "J.League club official store — jerseys" },
  "source": "shopify",                    // rakuten / shopify / html
  "query": { "store": "https://example-club-store.jp", "keyword": "ユニフォーム" },
  "variants": ["M", "L", "XL"],           // shopify のみ: 監視するサイズ
  "events": ["restock", "new", "priceDrop"]
}
```

| source | 取得方法 | サイズ別の在庫 | 向いている対象 |
|---|---|---|---|
| `shopify` | ストアの `/products.json` | ○ | Shopify で作られたクラブ公式・アニメ公式・ホビーショップ |
| `html` | ページ内の文言で判定 | × | APIのない公式通販の単品ページ |
| `rakuten` | 楽天市場商品検索API | ×（商品単位のみ） | サッカーショップ、ホビーショップの楽天店 |

`query` の項目:
- `shopify`: `store`（ストアのURL）、`handle`（単品）または `keyword`（一覧から絞り込み）
- `html`: `url`、`title`、`inStock`（在庫ありの文言・正規表現）、`outOfStock`（在庫なしの文言・正規表現）
- `rakuten`: `keyword`、`minPrice`、`maxPrice`、`genreId`、`shopCode`、`hits`、`sort`

## 構成

```
src/
  index.js          監視ループ（--once / --demo / --dry-run）
  config.js         .env と監視設定の読み込み
  state.js          在庫状態・無料チャンネルの配信予約・監視の成否を data/state.json に保存
  detect.js         前回との差分から restock / new / priceDrop を判定
  health.js         失敗が続いたとき・復旧したときの管理者向け通知
  sources/          shopify / html / rakuten / mock（デモ）
  notify/format.js  通知の文面（英語＋代行リンク、無料チャンネル用の文言）
  notify/index.js   配信先の振り分けと無料チャンネルへの遅延配信
  notify/discord.js Discord Webhook への送信（429 のときは待って再送）
```

## 運用上の注意

- **保守**: 監視先のサイトが変わると取得できなくなります。`#bot-status` に警告が来たら、`config/watches.json` の該当する監視を直してください
- **利用規約とアクセス頻度**: `shopify` と `html` は相手のサイトの規約と robots.txt を確認し、監視間隔を短くしすぎないでください。楽天APIは1秒1回までにしています
- **扱わないもの**: チケットなど、法律で転売が規制されている商品は監視対象にしないでください

## 次にやること

- [ ] 監視する実在のショップと商品を選ぶ（サッカー・アニメそれぞれ5〜10件）
- [ ] Discord サーバーを作り、Webhook を `.env` に設定して実際に届くか試す
- [ ] 商品名の英訳（今は日本語のまま）
- [ ] 常時稼働の置き場所（小さなVPS、Cloud Run＋スケジューラなど）
- [ ] Whop で有料ロールの販売ページを作る
