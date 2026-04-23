# stock-analyze-cli

日本株・米国株の分析を Claude Desktop / Claude Code で実行するためのローカル CLI 環境。MCP サーバー + スキル + JSON ファイルで構成される。

## 概要

既存の Web アプリ `stock-analyze-ai` を、クラウドサービス依存なしの Claude ベースのローカル環境に移行したもの。

### 設計思想

1. **ハーネスエンジニアリング** — Claude 自身が分析ハーネスとして動作し、UI/バックエンドコードに縛られずに自律的に分析を行う
2. **ファクト/AI 分析の分離** — MCP ツールがファクト提供、スキルが AI 分析フレームワーク
3. **ローカルファースト** — データは JSON ファイル、外部 API は株価系のみ（ニュースは Web 検索で代替）

### 廃止されたサービス

- Azure Static Web Apps
- Azure Cosmos DB
- Azure OpenAI
- Finlight
- GNews
- Tavily
- Google OAuth

### 継続するサービス

- Yahoo Finance (yahoo-finance2 npm)
- FMP API
- SEC EDGAR
- Semantic Scholar
- TDnet（やのしん）

## アーキテクチャ

3層構成:

| レイヤー | 役割 | 実装 |
|---------|------|------|
| **Claude (Desktop / Code)** | 対話・判断・ハーネス | Claude 本体 |
| **スキル群** | AI 分析フレームワーク（プロンプトテンプレート） | `skills/` 配下の Markdown |
| **MCP サーバー** | ファクト提供・データ永続化・可視化 | `mcp-server/` (TypeScript) |
| **データソース** | 外部 API / ローカル JSON | 外部 API + `data/` |

ユーザーの自然言語リクエスト → Claude がスキルを呼び出す → スキルが MCP ツールを連続呼び出し → ファクト集約 → AI 分析 → 結果出力・永続化

## ディレクトリ構成

```
stock-analyze-cli/
├── mcp-server/          # MCP サーバー実装 (TypeScript)
│   └── src/
│       ├── index.ts     # エントリポイント
│       ├── lib/         # 外部APIクライアント + ユーティリティ
│       ├── tools/       # MCPツール（market/portfolio/judgment/viz/data）
│       └── types/       # 型定義
├── skills/              # Claude スキル定義 (Markdown)
├── templates/           # 可視化HTMLテンプレート
├── data/                # JSONファイル（ポートフォリオ、判定キャッシュ等）
│   ├── portfolio.json
│   ├── watchlist.json
│   ├── judgments/       # 銘柄別判定履歴
│   ├── sectors/         # セクター分析結果
│   ├── screening/       # スクリーニング結果キャッシュ
│   └── static/          # 東証銘柄マスタ
├── scripts/             # ユーティリティスクリプト
└── output/              # 生成されたHTMLファイル（.gitignore）
```

## MCP ツール一覧 (29個)

5 グループ構成。

### market_* (10個)

株価・ファンダメンタルズ・開示・論文検索

| ツール | 説明 |
|--------|------|
| `market_quote` | 単一銘柄の最新株価 |
| `market_quotes` | 複数銘柄の一括取得 |
| `market_search` | 銘柄検索 |
| `market_history` | 株価履歴 |
| `market_fundamentals` | PER/PBR/ROE等 |
| `market_sectors` | セクター分類 |
| `market_screening` | 定量フィルタスクリーニング |
| `market_disclosures` | TDnet 適時開示 |
| `market_sec_filing` | SEC EDGAR 開示書類 |
| `market_paper_search` | Semantic Scholar 学術論文検索 |

### portfolio_* / watchlist_* (7個)

ポートフォリオ・ウォッチリスト管理（JSON ファイル永続化）

### judgment_* (3個)

AI 判定キャッシュ管理（保存・読み込み・一覧）

### viz_* (5個)

HTML 可視化（ローソク足、円グラフ、ヒートマップ、ネットワーク、テーブル）

### data_* (4個)

静的データ・設定（東証銘柄マスタ、ユーザー設定）

## スキル一覧 (9個)

| スキル | 起動トリガー | 概要 |
|--------|------------|------|
| `stock-judgment` | 「トヨタを判定して」 | 3軸スコアリング総合判定 |
| `growth-discovery` | 「成長株を探して」 | 3パイプライン（構造変化→企業→市場ギャップ） |
| `screening` | 「バリュー株を探して」 | 定量フィルタ+AI評価 |
| `portfolio-chat` | 「ポートフォリオを見て」 | 保有銘柄の総合分析 |
| `related-stocks` | 「トヨタの関連銘柄は？」 | 7カテゴリのネットワーク |
| `trend-analysis` | 「今のトレンドは？」 | マクロトレンド×銘柄 |
| `news-mapping` | 「このニュースで動く銘柄は？」 | ニュース→銘柄マッピング |
| `sector-analysis` | 「半導体セクターを分析して」 | 決算短信キーワード抽出 |
| `market-overview` | 「市場の概況は？」 | 日次サマリー |

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数

`.env.example` を `.env` にコピーして、APIキーを設定:

```
FMP_API_KEY=your_fmp_key
SEMANTIC_SCHOLAR_API_KEY=your_s2_key
```

- Yahoo Finance は npm パッケージのため APIキー不要
- TDnet（やのしん）、SEC EDGAR は公開APIのため APIキー不要

### 3. ビルド

```bash
npm run build
```

### 4. Claude Code での利用

リポジトリルートに `.claude/settings.local.json` が設定済み。Claude Code でこのリポジトリを開けば自動的に MCP サーバーが認識される。

### 5. Claude Desktop での利用

`claude_desktop_config.json` に以下を追加:

```json
{
  "mcpServers": {
    "stock-analyzer": {
      "command": "node",
      "args": ["C:/Users/nom40/Documents/Product/stock-analyze-cli/mcp-server/dist/index.js"],
      "env": {
        "DATA_DIR": "C:/Users/nom40/Documents/Product/stock-analyze-cli/data",
        "TEMPLATE_DIR": "C:/Users/nom40/Documents/Product/stock-analyze-cli/templates",
        "OUTPUT_DIR": "C:/Users/nom40/Documents/Product/stock-analyze-cli/output"
      }
    }
  }
}
```

スキルは Claude Desktop の Projects 機能で `skills/` 配下のファイルをナレッジとして追加する。

## コマンド

```bash
npm run build         # TypeScript コンパイル
npm run dev           # 開発モード（tsx watch）
npm run start         # MCPサーバー起動
npm test              # テスト実行（Vitest）
npm run test:coverage # カバレッジ付きテスト
npm run lint          # 型チェック
```

## データ移行（初回のみ）

既存 stock-analyze-ai (Azure Cosmos DB) からデータ移行:

```bash
export COSMOS_DB_ENDPOINT=https://xxx.documents.azure.com:443/
export COSMOS_DB_KEY=xxxxx
export MIGRATE_USER_ID=your-email@example.com
npx tsx scripts/migrate-cosmos.ts
```

詳細は `CLAUDE.md` の「データ移行」セクション参照。

## 使用例

### Claude Code での対話例

```
User: トヨタを判定して
Claude: [stock-judgment スキル起動]
  1. market_quote で株価取得
  2. market_fundamentals で財務データ取得
  3. market_disclosures で直近開示取得
  4. WebSearch で競合・外部環境調査
  5. judgment_save で結果保存
  → バリュエーション評価、3軸スコア、投資判断を出力
```

### ポートフォリオ分析

```
User: ポートフォリオを見て
Claude: [portfolio-chat スキル起動]
  1. portfolio_summary で時価・損益計算
  2. market_sectors でセクター分類
  3. viz_pie_chart でセクター円グラフ生成
  → 分散状況、集中リスク、リバランス提案を出力
```

## テスト

117 tests, 13 test files, Vitest。

```bash
npm test
```

## ライセンス

Private use only.
