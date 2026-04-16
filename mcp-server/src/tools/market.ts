import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getQuote, getQuotes } from "../lib/yahoo-finance.js";

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
}
