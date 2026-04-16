import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readJsonFile, writeJsonFile } from "../lib/json-store.js";
import { getQuotes } from "../lib/yahoo-finance.js";
import type {
  PortfolioData,
  PortfolioHolding,
  EnrichedHolding,
  PortfolioSummary,
} from "../types/portfolio.js";

const ACCOUNT_TYPE_ENUM = z.enum([
  "つみたて投資枠",
  "成長投資枠",
  "特定口座",
  "一般口座",
]);

export function registerPortfolioTools(server: McpServer): void {
  server.tool(
    "portfolio_get",
    "ポートフォリオの保有銘柄一覧を取得する",
    {},
    async () => {
      const portfolio = await readJsonFile<PortfolioData>("portfolio.json", {
        holdings: [],
        updatedAt: "",
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(portfolio, null, 2) }],
      };
    },
  );

  server.tool(
    "portfolio_add",
    "ポートフォリオに銘柄を追加する",
    {
      symbol: z.string().describe("銘柄コード（例: 7203.T）"),
      shares: z.number().describe("保有株数"),
      averageCost: z.number().describe("平均取得単価"),
      accountType: ACCOUNT_TYPE_ENUM.optional().describe("口座種別"),
      acquiredAt: z.string().optional().describe("取得日（YYYY-MM-DD）"),
      memo: z.string().optional().describe("メモ"),
    },
    async ({ symbol, shares, averageCost, accountType, acquiredAt, memo }) => {
      const portfolio = await readJsonFile<PortfolioData>("portfolio.json", {
        holdings: [],
        updatedAt: "",
      });

      const holding: PortfolioHolding = { symbol, shares, averageCost };
      if (accountType) holding.accountType = accountType;
      if (acquiredAt) holding.acquiredAt = acquiredAt;
      if (memo) holding.memo = memo;

      portfolio.holdings.push(holding);
      portfolio.updatedAt = new Date().toISOString();
      await writeJsonFile("portfolio.json", portfolio);

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: true, portfolio }, null, 2) }],
      };
    },
  );

  server.tool(
    "portfolio_update",
    "ポートフォリオ内の保有銘柄情報を更新する",
    {
      symbol: z.string().describe("銘柄コード"),
      shares: z.number().optional().describe("保有株数"),
      averageCost: z.number().optional().describe("平均取得単価"),
      accountType: ACCOUNT_TYPE_ENUM.optional().describe("口座種別"),
      memo: z.string().optional().describe("メモ"),
    },
    async ({ symbol, shares, averageCost, accountType, memo }) => {
      const portfolio = await readJsonFile<PortfolioData>("portfolio.json", {
        holdings: [],
        updatedAt: "",
      });

      const holding = portfolio.holdings.find((h) => h.symbol === symbol);
      if (!holding) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: `銘柄 ${symbol} はポートフォリオに存在しません` }) }],
        };
      }

      if (shares !== undefined) holding.shares = shares;
      if (averageCost !== undefined) holding.averageCost = averageCost;
      if (accountType !== undefined) holding.accountType = accountType;
      if (memo !== undefined) holding.memo = memo;

      portfolio.updatedAt = new Date().toISOString();
      await writeJsonFile("portfolio.json", portfolio);

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: true, portfolio }, null, 2) }],
      };
    },
  );

  server.tool(
    "portfolio_remove",
    "ポートフォリオから銘柄を削除する",
    {
      symbol: z.string().describe("銘柄コード"),
    },
    async ({ symbol }) => {
      const portfolio = await readJsonFile<PortfolioData>("portfolio.json", {
        holdings: [],
        updatedAt: "",
      });

      const index = portfolio.holdings.findIndex((h) => h.symbol === symbol);
      if (index === -1) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: `銘柄 ${symbol} はポートフォリオに存在しません` }) }],
        };
      }

      portfolio.holdings.splice(index, 1);
      portfolio.updatedAt = new Date().toISOString();
      await writeJsonFile("portfolio.json", portfolio);

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: true, portfolio }, null, 2) }],
      };
    },
  );

  server.tool(
    "portfolio_summary",
    "ポートフォリオのサマリー（時価総額・含み損益）を取得する",
    {},
    async () => {
      const portfolio = await readJsonFile<PortfolioData>("portfolio.json", {
        holdings: [],
        updatedAt: "",
      });

      if (portfolio.holdings.length === 0) {
        const empty: PortfolioSummary = {
          totalMarketValue: 0,
          totalCost: 0,
          totalUnrealizedGain: 0,
          totalUnrealizedGainPercent: 0,
          holdings: [],
        };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(empty, null, 2) }],
        };
      }

      const symbols = portfolio.holdings.map((h) => h.symbol);
      const quotes = await getQuotes(symbols);
      const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

      let totalMarketValue = 0;
      let totalCost = 0;

      const enrichedHoldings: EnrichedHolding[] = portfolio.holdings.map((h) => {
        const quote = quoteMap.get(h.symbol);
        const currentPrice = quote?.price ?? 0;
        const marketValue = currentPrice * h.shares;
        const cost = h.averageCost * h.shares;
        const unrealizedGain = (currentPrice - h.averageCost) * h.shares;
        const unrealizedGainPercent = cost !== 0 ? (unrealizedGain / cost) * 100 : 0;

        totalMarketValue += marketValue;
        totalCost += cost;

        return {
          ...h,
          name: quote?.name,
          currentPrice,
          change: quote?.change,
          changePercent: quote?.changePercent,
          marketValue,
          unrealizedGain,
          unrealizedGainPercent,
        };
      });

      const summary: PortfolioSummary = {
        totalMarketValue,
        totalCost,
        totalUnrealizedGain: totalMarketValue - totalCost,
        totalUnrealizedGainPercent: totalCost !== 0 ? ((totalMarketValue - totalCost) / totalCost) * 100 : 0,
        holdings: enrichedHoldings,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
      };
    },
  );

  server.tool(
    "watchlist_get",
    "ウォッチリストを取得する",
    {},
    async () => {
      const watchlist = await readJsonFile<string[]>("watchlist.json", []);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(watchlist) }],
      };
    },
  );

  server.tool(
    "watchlist_set",
    "ウォッチリストを設定する",
    {
      symbols: z.array(z.string()).describe("銘柄コードの配列"),
    },
    async ({ symbols }) => {
      await writeJsonFile("watchlist.json", symbols);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: true, symbols }) }],
      };
    },
  );
}
