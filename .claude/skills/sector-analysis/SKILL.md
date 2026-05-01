---
name: sector-analysis
description: セクター内の複数企業の決算短信テキストから共通キーワード（ポジ/ネガ）を抽出し、業界トレンドを可視化する。「半導体セクターを分析して」「輸送用機器の動向は？」等で起動。
---

# セクター分析スキル

## トリガー例
- 「半導体セクターを分析して」
- 「輸送用機器の動向は？」
- 「銀行業のトレンドは？」

## 分析フレームワーク
同一業種の複数企業（5社以上）の決算短信・業績修正テキストから**2社以上で共通言及**されるキーワードを抽出。業界全体のトレンドを可視化。

## 抽出ルール
- 1社のみ言及のキーワードは除外
- 固有名詞・具体的テーマを重視（「半導体」「EV」「法改正」「原油価格」等）
- ポジティブ/ネガティブを文脈で区別

## カテゴリ分類
- 需要・受注動向
- コスト
- 事業構造施策
- 財務・会計
- 市況・相場
- 価格改定

## 使用するMCPツール
- `market_sectors(symbols)` — セクター所属銘柄確認
- `data_major_stocks()` — メジャー銘柄取得
- `market_disclosures(symbol)` — 各企業の決算短信取得
- `WebFetch(url)` — 開示本文取得
- `viz_ranking_table(data, columns)` — キーワードランキング表示

## ワークフロー
1. 対象セクターの銘柄を特定（tse-sectors.json または market_sectors で確認）
2. 上位5〜10社について market_disclosures で直近の [earnings] / [revision] を取得
3. 各開示のdocumentUrlからWebFetchでテキスト取得
4. テキストから共通キーワードを抽出（2社以上で言及）
5. ポジティブ/ネガティブに分類、カテゴリ付与
6. viz_ranking_table でキーワードランキングを生成

## 出力フォーマット
```json
{
  "sectorName": "...",
  "totalDisclosures": 数,
  "positiveCompanies": 数,
  "negativeCompanies": 数,
  "neutralCompanies": 数,
  "positiveKeywords": [
    { "keyword": "...", "count": N, "sentiment": "positive", "category": "...", "companies": ["XXXX.T"] }
  ],
  "negativeKeywords": [ ... ],
  "categoryBreakdown": [
    { "category": "需要・受注動向", "positiveCount": N, "negativeCount": N }
  ]
}
```

## 分析上の注意点
- 開示本文のPDFは読み込みが重いため、必要な部分のみ抽出
- 2社以上で共通言及のあるキーワードに限定（ノイズ排除）
- 同じキーワードでも文脈により正反対の意味になることに注意
