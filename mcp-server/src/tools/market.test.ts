import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerMarketTools } from "./market.js";

// Mock yahoo-finance
vi.mock("../lib/yahoo-finance.js", () => ({
  getQuote: vi.fn(),
  getQuotes: vi.fn(),
  searchStocks: vi.fn(),
  getHistory: vi.fn(),
  getStockFundamentals: vi.fn(),
  getSectors: vi.fn(),
}));

import {
  getQuote,
  getQuotes,
  searchStocks,
  getHistory,
  getStockFundamentals,
  getSectors,
} from "../lib/yahoo-finance.js";

const mockGetQuote = vi.mocked(getQuote);
const mockGetQuotes = vi.mocked(getQuotes);
const mockSearchStocks = vi.mocked(searchStocks);
const mockGetHistory = vi.mocked(getHistory);
const mockGetStockFundamentals = vi.mocked(getStockFundamentals);
const mockGetSectors = vi.mocked(getSectors);

describe("registerMarketTools", () => {
  const registeredTools: Map<string, { description: string; schema: unknown; handler: Function }> = new Map();

  const mockServer = {
    tool: vi.fn(
      (name: string, description: string, schema: unknown, handler: Function) => {
        registeredTools.set(name, { description, schema, handler });
      },
    ),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    registeredTools.clear();
    registerMarketTools(mockServer as never);
  });

  it("registers all 6 market tools", () => {
    expect(mockServer.tool).toHaveBeenCalledTimes(6);
    expect(registeredTools.has("market_quote")).toBe(true);
    expect(registeredTools.has("market_quotes")).toBe(true);
    expect(registeredTools.has("market_search")).toBe(true);
    expect(registeredTools.has("market_history")).toBe(true);
    expect(registeredTools.has("market_fundamentals")).toBe(true);
    expect(registeredTools.has("market_sectors")).toBe(true);
  });

  it("market_quote returns a single stock quote as JSON", async () => {
    const mockQuote = {
      symbol: "7203.T",
      name: "トヨタ自動車",
      price: 2500,
      change: 50,
      changePercent: 2.04,
      currency: "JPY",
      marketState: "REGULAR",
      exchange: "Tokyo",
    };
    mockGetQuote.mockResolvedValue(mockQuote as never);

    const handler = registeredTools.get("market_quote")!.handler;
    const result = await handler({ symbol: "7203.T" });

    expect(mockGetQuote).toHaveBeenCalledWith("7203.T");
    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify(mockQuote, null, 2) }],
    });
  });

  it("market_quotes returns multiple stock quotes as JSON", async () => {
    const mockQuotesList = [
      {
        symbol: "7203.T",
        name: "トヨタ自動車",
        price: 2500,
        change: 50,
        changePercent: 2.04,
        currency: "JPY",
        marketState: "REGULAR",
        exchange: "Tokyo",
      },
      {
        symbol: "6758.T",
        name: "ソニーグループ",
        price: 3000,
        change: -30,
        changePercent: -0.99,
        currency: "JPY",
        marketState: "REGULAR",
        exchange: "Tokyo",
      },
    ];
    mockGetQuotes.mockResolvedValue(mockQuotesList as never);

    const handler = registeredTools.get("market_quotes")!.handler;
    const result = await handler({ symbols: ["7203.T", "6758.T"] });

    expect(mockGetQuotes).toHaveBeenCalledWith(["7203.T", "6758.T"]);
    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify(mockQuotesList, null, 2) }],
    });
  });

  it("market_quotes handles empty array", async () => {
    mockGetQuotes.mockResolvedValue([]);

    const handler = registeredTools.get("market_quotes")!.handler;
    const result = await handler({ symbols: [] });

    expect(mockGetQuotes).toHaveBeenCalledWith([]);
    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify([], null, 2) }],
    });
  });

  it("market_search calls searchStocks and returns results", async () => {
    const mockResults = [
      { symbol: "7203.T", name: "トヨタ自動車", exchange: "Tokyo", type: "EQUITY" },
    ];
    mockSearchStocks.mockResolvedValue(mockResults);

    const handler = registeredTools.get("market_search")!.handler;
    const result = await handler({ query: "トヨタ" });

    expect(mockSearchStocks).toHaveBeenCalledWith("トヨタ");
    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify(mockResults, null, 2) }],
    });
  });

  it("market_history calls getHistory with correct arguments", async () => {
    const mockHistory = [
      { date: "2024-01-01", open: 2500, high: 2550, low: 2480, close: 2520, volume: 1000000 },
    ];
    mockGetHistory.mockResolvedValue(mockHistory);

    const handler = registeredTools.get("market_history")!.handler;
    const result = await handler({ symbol: "7203.T", period1: "2024-01-01", period2: "2024-01-31", interval: "1d" });

    expect(mockGetHistory).toHaveBeenCalledWith("7203.T", "2024-01-01", "2024-01-31", "1d");
    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify(mockHistory, null, 2) }],
    });
  });

  it("market_fundamentals calls getStockFundamentals", async () => {
    const mockFundamentals = {
      symbol: "7203.T",
      sector: "Consumer Cyclical",
      industry: "Auto Manufacturers",
      netCashRatio: 0.5,
      roe: 0.12,
      payoutRatio: 0.3,
      forwardPE: 10.5,
      evToEbitda: 8.2,
      eps: 250,
      bps: 2000,
      revenueYoY: 0.08,
      earningsYoY: 0.15,
      incomeStatements: [],
      quarterlyEarnings: [],
    };
    mockGetStockFundamentals.mockResolvedValue(mockFundamentals);

    const handler = registeredTools.get("market_fundamentals")!.handler;
    const result = await handler({ symbol: "7203.T" });

    expect(mockGetStockFundamentals).toHaveBeenCalledWith("7203.T");
    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify(mockFundamentals, null, 2) }],
    });
  });

  it("market_sectors calls getSectors with symbols array", async () => {
    const mockSectors = {
      "7203.T": { sector: "Consumer Cyclical", industry: "Auto Manufacturers" },
      "6758.T": { sector: "Technology", industry: "Consumer Electronics" },
    };
    mockGetSectors.mockResolvedValue(mockSectors);

    const handler = registeredTools.get("market_sectors")!.handler;
    const result = await handler({ symbols: ["7203.T", "6758.T"] });

    expect(mockGetSectors).toHaveBeenCalledWith(["7203.T", "6758.T"]);
    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify(mockSectors, null, 2) }],
    });
  });
});
