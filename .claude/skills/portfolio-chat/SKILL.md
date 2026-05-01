---
name: portfolio-chat
description: ユーザーのポートフォリオを分析し、セクター配分・個別銘柄状況・リバランス提案を行う。「ポートフォリオを見て」「保有銘柄の状況は？」「リバランス提案して」等のリクエストで起動。
---

# ポートフォリオチャットスキル

## トリガー例
- 「ポートフォリオを見て」
- 「保有銘柄の状況は？」
- 「リバランス提案して」
- 「ポートフォリオのリスクは？」

## 分析フレームワーク
- ファクト（数値）と AI の推測を明確に区別
- 分散・集中リスク、セクター配分、個別銘柄の評価を統合
- 最終判断はユーザーであることを前提

## 使用するMCPツール
- `portfolio_get()` — 保有銘柄一覧
- `portfolio_summary()` — 時価・損益計算済みのサマリー
- `market_sectors(symbols)` — セクター分類
- `market_fundamentals(symbol)` — 個別銘柄深堀り時
- `judgment_list()` — 保有銘柄の過去判定一覧
- `judgment_get(symbol)` — 特定銘柄の判定履歴
- `market_disclosures(symbol)` — 適時開示（個別深堀り時）
- `viz_pie_chart(data, title)` — セクター配分円グラフ
- `viz_heatmap(data, title)` — 損益ヒートマップ

## ワークフロー（ポートフォリオ全体分析）
1. portfolio_summary で時価・含み損益・銘柄一覧を一括取得
2. market_sectors で全銘柄のセクター情報を一括取得
3. judgment_list で過去判定のある銘柄を確認
4. セクター配分・損益率分布を集計
5. viz_pie_chart でセクター円グラフ、viz_heatmap で損益ヒートマップ生成
6. Markdownレポートを作成（テーブル + 分析コメント + 可視化ファイルパス）

## ワークフロー（個別銘柄深堀り）
1. market_fundamentals で財務データ取得
2. market_disclosures で直近開示確認
3. judgment_get で過去判定参照
4. ユーザー質問への具体回答

## 出力フォーマット
- Markdownテーブル（保有銘柄一覧: コード/名前/セクター/株数/取得単価/現在値/時価/含み損益/構成比/口座）
- セクター配分サマリー
- HTMLファイルパス（円グラフ・ヒートマップ）
- 分析コメント（分散/集中リスク、評価）
- リバランス提案（あれば）

## 分析上の注意点
- 「買い/売り」の断定は避け、ファクトと分析を提示してユーザー判断に委ねる
- セクター情報が取得できない銘柄は「不明」として扱う
- バッチツール（portfolio_summary, market_sectors, judgment_list）を優先使用して API呼び出しを最小化
