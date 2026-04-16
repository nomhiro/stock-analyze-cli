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
}
