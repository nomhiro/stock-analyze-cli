import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getQuote,
  getQuotes,
  searchStocks,
  getHistory,
  getStockFundamentals,
  getSectors,
} from "../lib/yahoo-finance.js";
import { readJsonFile, writeJsonFile } from "../lib/json-store.js";
import type { StockQuote } from "../types/stock.js";

export function registerMarketTools(server: McpServer): void {
  server.tool(
    "market_quote",
    "単一銘柄の最新株価を取得する（価格、変動率、出来高、PER、PBR等）",
    { symbol: z.string().describe("銘柄コード（例: 7203.T）") },
    async ({ symbol }) => {
      const quote = await getQuote(symbol);
      return { content: [{ type: "text" as const, text: JSON.stringify(quote, null, 2) }] };
    },
  );

  server.tool(
    "market_quotes",
    "複数銘柄の最新株価を一括取得する",
    { symbols: z.array(z.string()).describe("銘柄コードの配列") },
    async ({ symbols }) => {
      const quotes = await getQuotes(symbols);
      return { content: [{ type: "text" as const, text: JSON.stringify(quotes, null, 2) }] };
    },
  );

  server.tool(
    "market_search",
    "銘柄名またはコードで株式を検索する",
    { query: z.string().describe("検索クエリ（銘柄名またはコード）") },
    async ({ query }) => {
      const results = await searchStocks(query);
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    },
  );

  server.tool(
    "market_history",
    "株価の履歴データ（ローソク足）を取得する",
    {
      symbol: z.string().describe("銘柄コード"),
      period1: z.string().describe("開始日（YYYY-MM-DD）"),
      period2: z.string().optional().describe("終了日（省略時は今日）"),
      interval: z.enum(["1d", "1wk", "1mo"]).optional().default("1d").describe("データ間隔"),
    },
    async ({ symbol, period1, period2, interval }) => {
      const history = await getHistory(symbol, period1, period2, interval);
      return { content: [{ type: "text" as const, text: JSON.stringify(history, null, 2) }] };
    },
  );

  server.tool(
    "market_fundamentals",
    "銘柄のファンダメンタルズ詳細を取得する（PER/PBR/ROE/ネットキャッシュ比率/業績推移等）",
    {
      symbol: z.string().describe("銘柄コード"),
    },
    async ({ symbol }) => {
      const fundamentals = await getStockFundamentals(symbol);
      return { content: [{ type: "text" as const, text: JSON.stringify(fundamentals, null, 2) }] };
    },
  );

  server.tool(
    "market_sectors",
    "指定銘柄群のセクター・業種情報を取得する",
    { symbols: z.array(z.string()).describe("銘柄コードの配列") },
    async ({ symbols }) => {
      const sectors = await getSectors(symbols);
      return { content: [{ type: "text" as const, text: JSON.stringify(sectors, null, 2) }] };
    },
  );

  server.tool(
    "market_screening",
    "定量フィルタで東証銘柄をスクリーニングする（PER/PBR/時価総額等）。結果はキャッシュされ同日内は再利用。",
    {
      perMax: z.number().optional().default(12).describe("PER上限"),
      pbrMax: z.number().optional().default(1.2).describe("PBR上限"),
      marketCapMin: z.number().optional().default(50).describe("時価総額下限（億円）"),
      dividendYieldMin: z.number().optional().default(0).describe("配当利回り下限（%）"),
      forceRefresh: z.boolean().optional().default(false).describe("キャッシュを無視して再取得"),
    },
    async ({ perMax, pbrMax, marketCapMin, dividendYieldMin, forceRefresh }) => {
      const cacheFile = "screening/latest.json";
      const today = new Date().toISOString().split("T")[0];

      // Check cache
      if (!forceRefresh) {
        const cached = await readJsonFile<{ date: string; results: StockQuote[] } | null>(cacheFile, null);
        if (cached && cached.date === today) {
          const filtered = applyScreeningFilter(cached.results, { perMax, pbrMax, marketCapMin, dividendYieldMin });
          return { content: [{ type: "text" as const, text: JSON.stringify({ fromCache: true, count: filtered.length, results: filtered }, null, 2) }] };
        }
      }

      // Fetch all TSE stocks
      const tseNames = await readJsonFile<Record<string, string>>("static/tse-names.json", {});
      const allSymbols = Object.keys(tseNames).map(code => code.includes(".T") ? code : `${code}.T`);

      const BATCH = 500;
      const DELAY = 1500;
      const allQuotes: StockQuote[] = [];

      for (let i = 0; i < allSymbols.length; i += BATCH) {
        const batch = allSymbols.slice(i, i + BATCH);
        const quotes = await getQuotes(batch);
        allQuotes.push(...quotes);
        if (i + BATCH < allSymbols.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY));
        }
      }

      // Save cache
      await writeJsonFile(cacheFile, { date: today, results: allQuotes });

      // Apply filter
      const filtered = applyScreeningFilter(allQuotes, { perMax, pbrMax, marketCapMin, dividendYieldMin });
      return { content: [{ type: "text" as const, text: JSON.stringify({ fromCache: false, count: filtered.length, results: filtered }, null, 2) }] };
    },
  );
}

export function applyScreeningFilter(
  quotes: StockQuote[],
  filter: { perMax: number; pbrMax: number; marketCapMin: number; dividendYieldMin: number },
): StockQuote[] {
  return quotes.filter((q) => {
    if (q.trailingPE != null && q.trailingPE > filter.perMax) return false;
    if (q.priceToBook != null && q.priceToBook > filter.pbrMax) return false;
    if (q.marketCap != null && q.marketCap / 1e8 < filter.marketCapMin) return false;
    if (filter.dividendYieldMin > 0 && (q.dividendYield == null || q.dividendYield < filter.dividendYieldMin)) return false;
    // Must have both PE and PB to be useful
    if (q.trailingPE == null || q.priceToBook == null) return false;
    return true;
  });
}
