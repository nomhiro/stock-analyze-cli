---
name: related-stocks
description: 指定銘柄の関連企業を7カテゴリ（競合・サプライチェーン上流/下流・資本関係・技術提携・業界テーマ・関連ニュース）で調査し、ネットワークマップを生成する。「トヨタの関連銘柄は？」「7203.Tのサプライチェーン」等で起動。
---

# 関連銘柄マップスキル

## トリガー例
- 「トヨタの関連銘柄を教えて」
- 「7203.Tのサプライチェーンは？」
- 「ソニーの競合は？」

## 分析フレームワーク
7カテゴリで関連企業を調査し、ネットワークグラフとして可視化する。

**カテゴリ:**
- competitors（競合・同業）: 3〜5社
- supply_chain_upstream（サプライチェーン上流）: 2〜4社
- supply_chain_downstream（サプライチェーン下流）: 2〜3社
- capital_relations（資本関係）: 2〜4社（子会社・持分法・筆頭株主）
- tech_alliance（技術提携）: 2〜3社
- industry_themes（業界テーマ）: 2〜3テーマ、各2〜3社
- recent_news（関連ニュース）: 3〜4件

## 関係種別（relationship_type）
競合 / 資本提携 / 子会社 / 持分法適用 / Tier1部品 / 原材料供給 / 技術パートナー / 合弁・供給 / サービス連携 / 設備投資 / 顧客

## エッジ強度（strength）
- strong: 売上・調達の10%以上、または資本関係あり
- medium: 継続的取引関係
- weak: 間接的関係、単発提携

## 使用するMCPツール
- `market_quote(symbol)` — 中心銘柄の基本情報
- `market_fundamentals(symbol)` — セクター・業種情報
- `WebSearch` — カテゴリごとの関連企業調査（5〜8回）
- `WebFetch` — 重要記事の詳細確認（最小限）
- `viz_network_graph(nodes, edges)` — ネットワークマップHTML生成

## ワークフロー
1. market_quote + market_fundamentals で中心銘柄情報を取得
2. カテゴリごとにWebSearchで関連企業を調査
   - 「{企業名} 競合 同業他社」
   - 「{企業名} サプライチェーン 仕入先」
   - 「{企業名} 子会社 資本関係」
   - 「{企業名} 技術提携 共同開発」
   - 「{企業名} 関連銘柄 業界テーマ」
   - 「{企業名} 最新ニュース」（topic=news, time_range=month）
3. 各企業の銘柄コード（.T）、relationship_type、strengthを特定
4. ノード・エッジを構築
5. viz_network_graph でHTML生成

## 出力フォーマット
- Markdownレポート（中心銘柄情報 + 各カテゴリの企業リスト）
- JSON構造（center, clusters[7], edges[], metadata）
- HTMLファイルパス（ネットワークマップ）

## 分析上の注意点
- 検索回数は合計5〜8回を目安
- 東証以外の企業・未上場企業は ticker を null にする
- 株価・時価総額は推測せず、不明なら null
- 情報が見つからないカテゴリは空配列にし、metadata.incomplete_clusters に記録
