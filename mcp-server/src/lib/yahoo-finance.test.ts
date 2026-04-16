import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock yahoo-finance2
vi.mock("yahoo-finance2", () => {
  const mockInstance = {
    quote: vi.fn(),
    chart: vi.fn(),
    search: vi.fn(),
    quoteSummary: vi.fn(),
    fundamentalsTimeSeries: vi.fn(),
  };
  return {
    default: vi.fn(() => mockInstance),
    __mockInstance: mockInstance,
  };
});

// Mock json-store
vi.mock("./json-store.js", () => ({
  readJsonFile: vi.fn(),
}));

import YahooFinance from "yahoo-finance2";
import { readJsonFile } from "./json-store.js";
import { getQuote, getQuotes, getHistory, searchStocks, getStockFundamentals } from "./yahoo-finance.js";

// Access the mock instance that the constructor returns
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { __mockInstance: mockYf } = await import("yahoo-finance2") as any;
const mockReadJsonFile = vi.mocked(readJsonFile);

describe("yahoo-finance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: TSE names return Toyota for 7203.T
    mockReadJsonFile.mockResolvedValue({
      "7203.T": "トヨタ自動車",
      "6758.T": "ソニーグループ",
    });
  });

  describe("getQuote", () => {
    it("returns a StockQuote with TSE name", async () => {
      mockYf.quote.mockResolvedValue({
        symbol: "7203.T",
        shortName: "Toyota Motor",
        regularMarketPrice: 2500,
        regularMarketChange: 50,
        regularMarketChangePercent: 2.04,
        currency: "JPY",
        marketState: "REGULAR",
        fullExchangeName: "Tokyo",
        regularMarketOpen: 2450,
        regularMarketDayHigh: 2520,
        regularMarketDayLow: 2440,
        regularMarketPreviousClose: 2450,
        regularMarketVolume: 5000000,
        marketCap: 40000000000000,
        trailingPE: 12.5,
        priceToBook: 1.2,
        dividendYield: 2.5,
        fiftyTwoWeekHigh: 2800,
        fiftyTwoWeekLow: 2000,
        epsTrailingTwelveMonths: 200,
        regularMarketTime: "2026-04-15T06:00:00.000Z",
      });

      const result = await getQuote("7203.T");

      expect(mockYf.quote).toHaveBeenCalledWith("7203.T", { lang: "ja-JP", region: "JP" });
      expect(result.symbol).toBe("7203.T");
      expect(result.name).toBe("トヨタ自動車"); // TSE name takes priority
      expect(result.price).toBe(2500);
      expect(result.change).toBe(50);
      expect(result.changePercent).toBe(2.04);
      expect(result.currency).toBe("JPY");
      expect(result.marketState).toBe("REGULAR");
      expect(result.volume).toBe(5000000);
    });

    it("falls back to shortName when TSE name is not found", async () => {
      mockReadJsonFile.mockResolvedValue({});
      mockYf.quote.mockResolvedValue({
        symbol: "AAPL",
        shortName: "Apple Inc.",
        regularMarketPrice: 150,
        regularMarketChange: 2,
        regularMarketChangePercent: 1.35,
        currency: "USD",
        marketState: "REGULAR",
        fullExchangeName: "NASDAQ",
      });

      const result = await getQuote("AAPL");
      expect(result.name).toBe("Apple Inc.");
    });

    it("handles missing fields with defaults", async () => {
      mockReadJsonFile.mockResolvedValue({});
      mockYf.quote.mockResolvedValue({});

      const result = await getQuote("UNKNOWN");
      expect(result.symbol).toBe("UNKNOWN");
      expect(result.price).toBe(0);
      expect(result.change).toBe(0);
      expect(result.currency).toBe("JPY");
      expect(result.marketState).toBe("CLOSED");
    });
  });

  describe("getQuotes", () => {
    it("returns empty array for empty input", async () => {
      const result = await getQuotes([]);
      expect(result).toEqual([]);
      expect(mockYf.quote).not.toHaveBeenCalled();
    });

    it("fetches multiple quotes in a single batch", async () => {
      mockYf.quote.mockResolvedValue([
        {
          symbol: "7203.T",
          shortName: "Toyota",
          regularMarketPrice: 2500,
          regularMarketChange: 50,
          regularMarketChangePercent: 2.04,
          currency: "JPY",
          marketState: "REGULAR",
          fullExchangeName: "Tokyo",
        },
        {
          symbol: "6758.T",
          shortName: "Sony",
          regularMarketPrice: 3000,
          regularMarketChange: -30,
          regularMarketChangePercent: -0.99,
          currency: "JPY",
          marketState: "REGULAR",
          fullExchangeName: "Tokyo",
        },
      ]);

      const result = await getQuotes(["7203.T", "6758.T"]);

      expect(mockYf.quote).toHaveBeenCalledTimes(1);
      expect(mockYf.quote).toHaveBeenCalledWith(["7203.T", "6758.T"], { lang: "ja-JP", region: "JP" });
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("トヨタ自動車");
      expect(result[1].name).toBe("ソニーグループ");
    });

    it("handles batching when symbols exceed BATCH_SIZE", async () => {
      // Create 501 symbols to trigger 2 batches
      const symbols = Array.from({ length: 501 }, (_, i) => `${1000 + i}.T`);
      mockReadJsonFile.mockResolvedValue({});

      // First batch: 500 symbols
      mockYf.quote.mockResolvedValueOnce(
        symbols.slice(0, 500).map((s) => ({
          symbol: s,
          regularMarketPrice: 100,
          regularMarketChange: 0,
          regularMarketChangePercent: 0,
          currency: "JPY",
          marketState: "CLOSED",
          fullExchangeName: "Tokyo",
        })),
      );
      // Second batch: 1 symbol
      mockYf.quote.mockResolvedValueOnce([
        {
          symbol: symbols[500],
          regularMarketPrice: 200,
          regularMarketChange: 0,
          regularMarketChangePercent: 0,
          currency: "JPY",
          marketState: "CLOSED",
          fullExchangeName: "Tokyo",
        },
      ]);

      const result = await getQuotes(symbols);

      expect(mockYf.quote).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(501);
      expect(result[500].price).toBe(200);
    });
  });

  describe("getHistory", () => {
    it("returns historical entries", async () => {
      mockYf.chart.mockResolvedValue({
        quotes: [
          { date: new Date("2026-01-01"), open: 100, high: 110, low: 95, close: 105, volume: 1000 },
          { date: new Date("2026-01-02"), open: 105, high: 115, low: 100, close: 110, volume: 1200 },
        ],
      });

      const result = await getHistory("7203.T", "2026-01-01", "2026-01-31");

      expect(mockYf.chart).toHaveBeenCalledWith("7203.T", {
        period1: "2026-01-01",
        period2: "2026-01-31",
        interval: "1d",
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        date: "2026-01-01",
        open: 100,
        high: 110,
        low: 95,
        close: 105,
        volume: 1000,
      });
    });

    it("handles empty quotes array", async () => {
      mockYf.chart.mockResolvedValue({ quotes: [] });

      const result = await getHistory("7203.T", "2026-01-01");
      expect(result).toEqual([]);
    });

    it("handles missing quotes property", async () => {
      mockYf.chart.mockResolvedValue({});

      const result = await getHistory("7203.T", "2026-01-01");
      expect(result).toEqual([]);
    });
  });

  describe("searchStocks", () => {
    it("returns EQUITY type results only", async () => {
      mockYf.search.mockResolvedValue({
        quotes: [
          { symbol: "7203.T", shortname: "Toyota", exchange: "JPX", quoteType: "EQUITY" },
          { symbol: "TOYOF", shortname: "Toyota OTC", exchange: "OTC", quoteType: "EQUITY" },
          { symbol: "7203.T-OPTIONS", shortname: "Toyota Options", exchange: "JPX", quoteType: "OPTION" },
        ],
      });

      const result = await searchStocks("トヨタ");

      expect(mockYf.search).toHaveBeenCalledWith("トヨタ", { lang: "ja-JP", region: "JP" });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        symbol: "7203.T",
        name: "トヨタ自動車",
        exchange: "JPX",
        type: "EQUITY",
      });
      expect(result[1].symbol).toBe("TOYOF");
    });

    it("returns empty array for BadRequestError", async () => {
      const error = new Error("Bad Request");
      error.name = "BadRequestError";
      mockYf.search.mockRejectedValue(error);

      const result = await searchStocks("invalid query");
      expect(result).toEqual([]);
    });

    it("re-throws non-BadRequestError errors", async () => {
      mockYf.search.mockRejectedValue(new Error("Network error"));

      await expect(searchStocks("test")).rejects.toThrow("Network error");
    });

    it("returns empty array when no quotes match", async () => {
      mockYf.search.mockResolvedValue({ quotes: [] });

      const result = await searchStocks("nonexistent");
      expect(result).toEqual([]);
    });
  });

  describe("getStockFundamentals", () => {
    it("returns fundamentals with sector and financial data", async () => {
      mockYf.quoteSummary.mockResolvedValue({
        defaultKeyStatistics: {
          forwardPE: 15.2,
          enterpriseToEbitda: 10.5,
          trailingEps: 200,
          bookValue: 1800,
          payoutRatio: 0.3,
          marketCap: 40000000000000,
        },
        financialData: {
          returnOnEquity: 0.12,
          marketCap: 40000000000000,
        },
        assetProfile: {
          sector: "Consumer Cyclical",
          industry: "Auto Manufacturers",
        },
      });

      // Balance sheet
      mockYf.fundamentalsTimeSeries.mockResolvedValueOnce([
        {
          currentAssets: 10000000000,
          totalLiabilitiesNetMinorityInterest: 8000000000,
          investmentinFinancialAssets: 1000000000,
        },
      ]);

      // Annual income
      mockYf.fundamentalsTimeSeries.mockResolvedValueOnce([
        { date: "2024-03-31", totalRevenue: 30000000000000, operatingIncome: 3000000000000, netIncome: 2000000000000 },
        { date: "2025-03-31", totalRevenue: 33000000000000, operatingIncome: 3300000000000, netIncome: 2200000000000 },
      ]);

      // Quarterly income
      mockYf.fundamentalsTimeSeries.mockResolvedValueOnce([
        { date: "2025-01-01", totalRevenue: 8000000000000, netIncome: 500000000000 },
      ]);

      const result = await getStockFundamentals("7203.T");

      expect(result.symbol).toBe("7203.T");
      expect(result.sector).toBe("Consumer Cyclical");
      expect(result.industry).toBe("Auto Manufacturers");
      expect(result.roe).toBe(0.12);
      expect(result.forwardPE).toBe(15.2);
      expect(result.incomeStatements).toHaveLength(2);
      expect(result.quarterlyEarnings).toHaveLength(1);
      expect(result.revenueYoY).toBeCloseTo(0.1);
      expect(result.earningsYoY).toBeCloseTo(0.1);
    });
  });
});
