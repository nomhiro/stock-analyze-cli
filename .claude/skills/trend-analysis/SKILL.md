---
name: trend-analysis
description: マクロな投資テーマ・トレンドを特定し、関連する日本株銘柄にマッピングする。「今のトレンドは？」「注目テーマを分析して」「投資テーマを教えて」等で起動。
---

# トレンド分析スキル

## トリガー例
- 「今の投資トレンドは？」
- 「注目テーマを分析して」
- 「これから伸びる業界は？」

## 分析フレームワーク
マクロ視点でテーマを特定し、テーマごとに日本株銘柄をマッピングする。
（※個別ニュースから銘柄を紐付けるのは news-mapping スキル）

## 使用するMCPツール
- `market_search(query)` — テーマ関連銘柄の検索
- `market_quote(symbol)` — 候補銘柄の基本情報
- `WebSearch` — 最新の業界トレンド、政策動向、産業レポート

## ワークフロー
1. WebSearchで最新のマクロトレンドを調査
2. 3〜5の主要投資テーマを特定
3. 各テーマについて影響業界・技術を整理
4. テーマごとに東証銘柄（.T）を3〜5社推薦
5. 推薦銘柄のうち代表2-3社について market_quote で現状確認
6. Markdownレポート出力

## 出力フォーマット
```json
{
  "themes": [
    {
      "topic": "テーマ名",
      "description": "...",
      "affectedIndustries": [...],
      "affectedTechnologies": [...],
      "timeHorizon": "short_term | medium_term | long_term",
      "sentiment": "bullish | bearish | neutral",
      "recommendedStocks": [
        { "symbol": "XXXX.T", "name": "...", "reason": "...", "exposure": "direct | indirect" }
      ]
    }
  ],
  "overallMarketSentiment": "全体見通し",
  "keyRisks": ["..."]
}
```

## 分析上の注意点
- 実在の東証上場銘柄のみを推薦（必ず.Tサフィックス）
- テーマは3〜5に絞る（多すぎると焦点がぼける）
- direct/indirect の区別を明確に
