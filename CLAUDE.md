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
