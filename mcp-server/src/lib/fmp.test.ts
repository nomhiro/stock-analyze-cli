import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getFMPQuote, getFMPQuotes, getFMPIncomeStatements, searchFMPStocks, getFMPFinancialSummary } from "./fmp.js";

describe("fmp", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    vi.stubEnv("FMP_API_KEY", "test-key-123");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getFMPQuote fetches a single quote", async () => {
    const mockQuote = [{
      symbol: "AAPL",
      name: "Apple Inc.",
      price: 195.5,
      change: 2.3,
      changesPercentage: 1.19,
      marketCap: 3000000000000,
      pe: 30.5,
      priceToBook: 45.2,
      volume: 50000000,
      avgVolume: 55000000,
      exchange: "NASDAQ",
      earningsAnnouncement: "2024-01-25",
    }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockQuote),
    });

    const result = await getFMPQuote("AAPL");

    expect(result).toEqual(mockQuote[0]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/quote/AAPL");
    expect(calledUrl).toContain("apikey=test-key-123");
  });

  it("getFMPQuotes returns empty array for empty input", async () => {
    const result = await getFMPQuotes([]);
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("getFMPIncomeStatements fetches income data", async () => {
    const mockIncome = [{
      date: "2023-09-30",
      symbol: "AAPL",
      revenue: 383285000000,
      grossProfit: 169148000000,
      grossProfitRatio: 0.4413,
      operatingIncome: 114301000000,
      operatingIncomeRatio: 0.2982,
      netIncome: 96995000000,
      netIncomeRatio: 0.2531,
      eps: 6.13,
      ebitda: 125820000000,
    }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockIncome),
    });

    const result = await getFMPIncomeStatements("AAPL", "annual", 1);

    expect(result).toEqual(mockIncome);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/income-statement/AAPL");
    expect(calledUrl).toContain("period=annual");
    expect(calledUrl).toContain("limit=1");
  });

  it("searchFMPStocks searches for stocks", async () => {
    const mockResults = [{
      symbol: "AAPL",
      name: "Apple Inc.",
      currency: "USD",
      stockExchange: "NASDAQ",
      exchangeShortName: "NASDAQ",
    }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResults),
    });

    const result = await searchFMPStocks("Apple", 5);

    expect(result).toEqual(mockResults);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/search");
    expect(calledUrl).toContain("query=Apple");
  });

  it("throws when FMP_API_KEY is not set", async () => {
    vi.stubEnv("FMP_API_KEY", "");

    await expect(getFMPQuote("AAPL")).rejects.toThrow("FMP_API_KEY is not configured");
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });

    await expect(getFMPQuote("AAPL")).rejects.toThrow("FMP API error: 401");
  });

  it("getFMPFinancialSummary aggregates multiple endpoints", async () => {
    const quote = [{ symbol: "AAPL", name: "Apple", price: 195, change: 0, changesPercentage: 0, marketCap: 3e12, pe: 30, priceToBook: 45, volume: 5e7, avgVolume: 5.5e7, exchange: "NASDAQ", earningsAnnouncement: null }];
    const income = [{ date: "2023-09-30", symbol: "AAPL", revenue: 383e9, grossProfit: 169e9, grossProfitRatio: 0.44, operatingIncome: 114e9, operatingIncomeRatio: 0.3, netIncome: 97e9, netIncomeRatio: 0.25, eps: 6.13, ebitda: 126e9 }];
    const balance = [{ date: "2023-09-30", symbol: "AAPL", totalAssets: 352e9, totalLiabilities: 290e9, totalStockholdersEquity: 62e9, cashAndCashEquivalents: 29e9, totalDebt: 111e9 }];
    const cashFlow = [{ date: "2023-09-30", symbol: "AAPL", operatingCashFlow: 110e9, capitalExpenditure: -11e9, freeCashFlow: 99e9 }];
    const growth = [{ symbol: "AAPL", revenueGrowth: -0.03, grossProfitGrowth: 0.01, epsgrowth: 0.02, operatingIncomeGrowth: -0.01, freeCashFlowGrowth: 0.05 }];

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(quote) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(income) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(balance) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(cashFlow) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(growth) });

    const result = await getFMPFinancialSummary("AAPL");

    expect(result.quote).toEqual(quote[0]);
    expect(result.incomeStatements).toEqual(income);
    expect(result.balanceSheet).toEqual(balance[0]);
    expect(result.cashFlow).toEqual(cashFlow[0]);
    expect(result.growth).toEqual(growth[0]);
  });
});
