---
name: news-mapping
description: 個別ニュース記事から影響する業界・銘柄を特定する。「最新ニュースと銘柄の関係は？」「このニュースで注目すべき銘柄は？」等で起動。
---

# ニュース×銘柄マッピングスキル

## トリガー例
- 「今日のニュースで注目すべき銘柄は？」
- 「この決算ニュースの影響銘柄は？」
- 「{イベント名}で動きそうな銘柄は？」

## 分析フレームワーク
個別ニュース記事を起点にテーマ抽出・銘柄マッピングする（ミクロ視点）。
需要ドライバー × コストドライバーの2軸で企業への影響を評価。
同じニュースでもバリューチェーン上の位置により影響の方向・大きさが異なることを意識する。

## 使用するMCPツール
- `WebSearch` — 最新ニュース検索（topic=news, time_range=day/week）
- `WebFetch` — 重要記事の本文取得
- `market_search(query)` — 影響銘柄の検索

## ワークフロー
1. ユーザーの関心がニュース選定にある場合: WebSearchで最新ニュース取得
2. ニュース記事の要約作成（3〜5文）
3. 上位3〜5の投資テーマを特定
4. 各テーマについて日本株3〜5社をマッピング
5. 各銘柄の影響方向（ポジ/ネガ）と根拠を明示

## 出力フォーマット
```json
{
  "newsSummary": "ニュース全体の要約（3〜5文）",
  "themes": [
    {
      "topic": "...",
      "description": "...",
      "affectedIndustries": [...],
      "timeHorizon": "short_term | medium_term | long_term",
      "sentiment": "bullish | bearish | neutral",
      "recommendedStocks": [
        { "symbol": "XXXX.T", "name": "...", "reason": "...", "exposure": "direct | indirect" }
      ]
    }
  ],
  "overallMarketSentiment": "...",
  "keyRisks": [...]
}
```

## 分析上の注意点
- 実在の東証上場銘柄のみ（.Tサフィックス）
- 需要とコストの両面から影響を評価
- バリューチェーン上の位置（素材/部品/完成品/サービス）で影響が異なることを明示
- 推測禁止: 推薦理由は必ずニュース内容に基づく
