# CLAUDE.md

## コマンド

```bash
npm run build        # TypeScript コンパイル
npm run dev          # 開発モード（tsx watch）
npm run start        # MCPサーバー起動
npm test             # テスト実行（Vitest）
npm run test:coverage # カバレッジ付きテスト
npm run lint         # 型チェック
```

## アーキテクチャ

日本株・米国株データ取得と AI 分析を支援する MCP サーバー + スキル群。
Claude Desktop / Claude Code の両方で同じ MCP サーバーとスキルを共有する。

### MCPサーバー

`mcp-server/src/` に TypeScript で実装。ツールは5グループ:
- `market_*` — 株価・ファンダメンタルズ・検索（Yahoo Finance, FMP, TDnet, SEC EDGAR, Semantic Scholar）
- `portfolio_*` — ポートフォリオ・ウォッチリスト管理（JSON ファイル）
- `judgment_*` — AI 判定キャッシュ管理（JSON ファイル）
- `viz_*` — HTML テンプレートベースの可視化
- `data_*` — 静的データ・ユーザー設定

### データ

`data/` 配下に JSON ファイルで永続化。東証銘柄は `.T` サフィックス付き。

### テスト規約

- テストフレームワーク: Vitest
- テストは対象ファイルと同じディレクトリに `*.test.ts` として配置
- Yahoo Finance → `vi.mock('yahoo-finance2')`
- FMP API → fetch をモック
- JSON ファイル I/O → `vi.mock('./json-store')` または `fs/promises` をモック

## データ移行（初回のみ）

既存の stock-analyze-ai (Azure Cosmos DB) からデータを移行する場合:

```bash
export COSMOS_DB_ENDPOINT=https://xxx.documents.azure.com:443/
export COSMOS_DB_KEY=xxxxx
export MIGRATE_USER_ID=your-email@example.com

npx tsx scripts/migrate-cosmos.ts
```

移行対象:
- `judgments` コンテナ → `data/judgments/{symbol}.json`
- `portfolios` コンテナ → `data/portfolio.json`
- `settings` (watchlist) → `data/watchlist.json`
- `settings` (anomaly) → `data/settings.json`
- `sectors` → `data/sectors/keywords.json`
- `screening` → `data/screening/latest.json`

`prompt-settings` は新システムでは不要のため移行しない。
移行元のデータベース名は `stock-analyzer`（`src/lib/cosmos-db.ts` で定義）。
