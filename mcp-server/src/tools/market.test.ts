import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerMarketTools, applyScreeningFilter } from "./market.js";

// Mock yahoo-finance
vi.mock("../lib/yahoo-finance.js", () => ({
  getQuote: vi.fn(),
  getQuotes: vi.fn(),
  searchStocks: vi.fn(),
  getHistory: vi.fn(),
  getStockFundamentals: vi.fn(),
  getSectors: vi.fn(),
}));

// Mock json-store
vi.mock("../lib/json-store.js", () => ({
  readJsonFile: vi.fn(),
  writeJsonFile: vi.fn(),
}));

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

const mockGetQuote = vi.mocked(getQuote);
const mockGetQuotes = vi.mocked(getQuotes);
const mockSearchStocks = vi.mocked(searchStocks);
const mockGetHistory = vi.mocked(getHistory);
const mockGetStockFundamentals = vi.mocked(getStockFundamentals);
const mockGetSectors = vi.mocked(getSectors);
const mockReadJsonFile = vi.mocked(readJsonFile);
const mockWriteJsonFile = vi.mocked(writeJsonFile);

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

  it("registers all 7 market tools", () => {
    expect(mockServer.tool).toHaveBeenCalledTimes(7);
    expect(registeredTools.has("market_quote")).toBe(true);
    expect(registeredTools.has("market_quotes")).toBe(true);
    expect(registeredTools.has("market_search")).toBe(true);
    expect(registeredTools.has("market_history")).toBe(true);
    expect(registeredTools.has("market_fundamentals")).toBe(true);
    expect(registeredTools.has("market_sectors")).toBe(true);
    expect(registeredTools.has("market_screening")).toBe(true);
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

  it("market_screening uses cache when available for today", async () => {
    const today = new Date().toISOString().split("T")[0];
    const cachedQuotes: StockQuote[] = [
      { symbol: "7203.T", name: "トヨタ", price: 2500, change: 0, changePercent: 0, currency: "JPY", marketState: "REGULAR", exchange: "Tokyo", trailingPE: 10, priceToBook: 1.0, marketCap: 30e12 },
    ];
    mockReadJsonFile.mockResolvedValueOnce({ date: today, results: cachedQuotes });

    const handler = registeredTools.get("market_screening")!.handler;
    const result = await handler({ perMax: 12, pbrMax: 1.2, marketCapMin: 50, dividendYieldMin: 0, forceRefresh: false });

    const parsed = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);
    expect(parsed.fromCache).toBe(true);
    expect(mockGetQuotes).not.toHaveBeenCalled();
  });

  it("market_screening fetches fresh data when no cache", async () => {
    // Cache miss
    mockReadJsonFile
      .mockResolvedValueOnce(null)  // screening/latest.json
      .mockResolvedValueOnce({ "7203": "トヨタ", "6758": "ソニー" }); // tse-names.json

    const freshQuotes: StockQuote[] = [
      { symbol: "7203.T", name: "トヨタ", price: 2500, change: 0, changePercent: 0, currency: "JPY", marketState: "REGULAR", exchange: "Tokyo", trailingPE: 10, priceToBook: 1.0, marketCap: 30e12 },
    ];
    mockGetQuotes.mockResolvedValue(freshQuotes);
    mockWriteJsonFile.mockResolvedValue(undefined);

    const handler = registeredTools.get("market_screening")!.handler;
    const result = await handler({ perMax: 12, pbrMax: 1.2, marketCapMin: 50, dividendYieldMin: 0, forceRefresh: false });

    const parsed = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);
    expect(parsed.fromCache).toBe(false);
    expect(mockGetQuotes).toHaveBeenCalled();
    expect(mockWriteJsonFile).toHaveBeenCalled();
  });
});

describe("applyScreeningFilter", () => {
  const makeQuote = (overrides: Partial<StockQuote>): StockQuote => ({
    symbol: "TEST.T",
    name: "Test",
    price: 1000,
    change: 0,
    changePercent: 0,
    currency: "JPY",
    marketState: "REGULAR",
    exchange: "Tokyo",
    trailingPE: 10,
    priceToBook: 1.0,
    marketCap: 100e8, // 100億
    ...overrides,
  });

  it("filters out stocks with PE above max", () => {
    const quotes = [makeQuote({ trailingPE: 15 }), makeQuote({ trailingPE: 10 })];
    const result = applyScreeningFilter(quotes, { perMax: 12, pbrMax: 2, marketCapMin: 50, dividendYieldMin: 0 });
    expect(result).toHaveLength(1);
    expect(result[0].trailingPE).toBe(10);
  });

  it("filters out stocks with PBR above max", () => {
    const quotes = [makeQuote({ priceToBook: 1.5 }), makeQuote({ priceToBook: 0.8 })];
    const result = applyScreeningFilter(quotes, { perMax: 20, pbrMax: 1.2, marketCapMin: 50, dividendYieldMin: 0 });
    expect(result).toHaveLength(1);
    expect(result[0].priceToBook).toBe(0.8);
  });

  it("filters out stocks with marketCap below min", () => {
    const quotes = [makeQuote({ marketCap: 30e8 }), makeQuote({ marketCap: 100e8 })];
    const result = applyScreeningFilter(quotes, { perMax: 20, pbrMax: 2, marketCapMin: 50, dividendYieldMin: 0 });
    expect(result).toHaveLength(1);
    expect(result[0].marketCap).toBe(100e8);
  });

  it("filters by dividend yield when specified", () => {
    const quotes = [
      makeQuote({ dividendYield: 3.0 }),
      makeQuote({ dividendYield: 1.0 }),
      makeQuote({ dividendYield: undefined }),
    ];
    const result = applyScreeningFilter(quotes, { perMax: 20, pbrMax: 2, marketCapMin: 50, dividendYieldMin: 2.0 });
    expect(result).toHaveLength(1);
    expect(result[0].dividendYield).toBe(3.0);
  });

  it("excludes stocks without PE or PB", () => {
    const quotes = [
      makeQuote({ trailingPE: undefined }),
      makeQuote({ priceToBook: undefined }),
      makeQuote({}),
    ];
    const result = applyScreeningFilter(quotes, { perMax: 20, pbrMax: 2, marketCapMin: 50, dividendYieldMin: 0 });
    expect(result).toHaveLength(1);
  });
});
