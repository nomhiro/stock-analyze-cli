import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerPortfolioTools } from "./portfolio.js";

// Mock json-store
vi.mock("../lib/json-store.js", () => ({
  readJsonFile: vi.fn(),
  writeJsonFile: vi.fn(),
}));

// Mock yahoo-finance
vi.mock("../lib/yahoo-finance.js", () => ({
  getQuotes: vi.fn(),
}));

import { readJsonFile, writeJsonFile } from "../lib/json-store.js";
import { getQuotes } from "../lib/yahoo-finance.js";

const mockReadJsonFile = vi.mocked(readJsonFile);
const mockWriteJsonFile = vi.mocked(writeJsonFile);
const mockGetQuotes = vi.mocked(getQuotes);

describe("registerPortfolioTools", () => {
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
    registerPortfolioTools(mockServer as never);
  });

  it("registers all 7 portfolio/watchlist tools", () => {
    expect(mockServer.tool).toHaveBeenCalledTimes(7);
    expect(registeredTools.has("portfolio_get")).toBe(true);
    expect(registeredTools.has("portfolio_add")).toBe(true);
    expect(registeredTools.has("portfolio_update")).toBe(true);
    expect(registeredTools.has("portfolio_remove")).toBe(true);
    expect(registeredTools.has("portfolio_summary")).toBe(true);
    expect(registeredTools.has("watchlist_get")).toBe(true);
    expect(registeredTools.has("watchlist_set")).toBe(true);
  });

  it("portfolio_get returns holdings", async () => {
    const portfolio = {
      holdings: [
        { symbol: "7203.T", shares: 100, averageCost: 2000 },
      ],
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mockReadJsonFile.mockResolvedValueOnce(portfolio);

    const handler = registeredTools.get("portfolio_get")!.handler;
    const result = await handler({});
    const parsed = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

    expect(parsed.holdings).toHaveLength(1);
    expect(parsed.holdings[0].symbol).toBe("7203.T");
  });

  it("portfolio_add appends holding and writes", async () => {
    const existing = { holdings: [], updatedAt: "" };
    mockReadJsonFile.mockResolvedValueOnce(existing);
    mockWriteJsonFile.mockResolvedValueOnce(undefined);

    const handler = registeredTools.get("portfolio_add")!.handler;
    const result = await handler({
      symbol: "7203.T",
      shares: 100,
      averageCost: 2000,
      accountType: "特定口座",
      memo: "テスト",
    });
    const parsed = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

    expect(parsed.success).toBe(true);
    expect(parsed.portfolio.holdings).toHaveLength(1);
    expect(parsed.portfolio.holdings[0].symbol).toBe("7203.T");
    expect(parsed.portfolio.holdings[0].accountType).toBe("特定口座");
    expect(parsed.portfolio.updatedAt).toBeTruthy();

    expect(mockWriteJsonFile).toHaveBeenCalledWith(
      "portfolio.json",
      expect.objectContaining({
        holdings: expect.arrayContaining([
          expect.objectContaining({ symbol: "7203.T", shares: 100 }),
        ]),
      }),
    );
  });

  it("portfolio_update modifies existing holding", async () => {
    const existing = {
      holdings: [{ symbol: "7203.T", shares: 100, averageCost: 2000 }],
      updatedAt: "",
    };
    mockReadJsonFile.mockResolvedValueOnce(existing);
    mockWriteJsonFile.mockResolvedValueOnce(undefined);

    const handler = registeredTools.get("portfolio_update")!.handler;
    const result = await handler({ symbol: "7203.T", shares: 200 });
    const parsed = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

    expect(parsed.success).toBe(true);
    expect(parsed.portfolio.holdings[0].shares).toBe(200);
    expect(parsed.portfolio.holdings[0].averageCost).toBe(2000); // unchanged
  });

  it("portfolio_update returns error for unknown symbol", async () => {
    const existing = { holdings: [], updatedAt: "" };
    mockReadJsonFile.mockResolvedValueOnce(existing);

    const handler = registeredTools.get("portfolio_update")!.handler;
    const result = await handler({ symbol: "9999.T", shares: 100 });
    const parsed = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

    expect(parsed.error).toContain("9999.T");
  });

  it("portfolio_remove filters out symbol", async () => {
    const existing = {
      holdings: [
        { symbol: "7203.T", shares: 100, averageCost: 2000 },
        { symbol: "6758.T", shares: 50, averageCost: 3000 },
      ],
      updatedAt: "",
    };
    mockReadJsonFile.mockResolvedValueOnce(existing);
    mockWriteJsonFile.mockResolvedValueOnce(undefined);

    const handler = registeredTools.get("portfolio_remove")!.handler;
    const result = await handler({ symbol: "7203.T" });
    const parsed = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

    expect(parsed.success).toBe(true);
    expect(parsed.portfolio.holdings).toHaveLength(1);
    expect(parsed.portfolio.holdings[0].symbol).toBe("6758.T");
  });

  it("portfolio_remove returns error for unknown symbol", async () => {
    const existing = { holdings: [], updatedAt: "" };
    mockReadJsonFile.mockResolvedValueOnce(existing);

    const handler = registeredTools.get("portfolio_remove")!.handler;
    const result = await handler({ symbol: "9999.T" });
    const parsed = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

    expect(parsed.error).toContain("9999.T");
  });

  it("portfolio_summary calculates gains correctly", async () => {
    const portfolio = {
      holdings: [
        { symbol: "7203.T", shares: 100, averageCost: 2000 },
        { symbol: "6758.T", shares: 50, averageCost: 3000 },
      ],
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mockReadJsonFile.mockResolvedValueOnce(portfolio);
    mockGetQuotes.mockResolvedValueOnce([
      {
        symbol: "7203.T",
        name: "トヨタ自動車",
        price: 2500,
        change: 50,
        changePercent: 2.04,
        currency: "JPY",
        marketState: "REGULAR",
        exchange: "JPX",
      },
      {
        symbol: "6758.T",
        name: "ソニーグループ",
        price: 2800,
        change: -200,
        changePercent: -6.67,
        currency: "JPY",
        marketState: "REGULAR",
        exchange: "JPX",
      },
    ]);

    const handler = registeredTools.get("portfolio_summary")!.handler;
    const result = await handler({});
    const parsed = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

    // 7203.T: marketValue=250000, cost=200000, gain=50000
    // 6758.T: marketValue=140000, cost=150000, gain=-10000
    // Total: marketValue=390000, cost=350000, gain=40000
    expect(parsed.totalMarketValue).toBe(390000);
    expect(parsed.totalCost).toBe(350000);
    expect(parsed.totalUnrealizedGain).toBe(40000);
    expect(parsed.totalUnrealizedGainPercent).toBeCloseTo((40000 / 350000) * 100, 2);

    expect(parsed.holdings).toHaveLength(2);
    expect(parsed.holdings[0].marketValue).toBe(250000);
    expect(parsed.holdings[0].unrealizedGain).toBe(50000);
    expect(parsed.holdings[0].unrealizedGainPercent).toBe(25);
    expect(parsed.holdings[1].marketValue).toBe(140000);
    expect(parsed.holdings[1].unrealizedGain).toBe(-10000);
    expect(parsed.holdings[1].unrealizedGainPercent).toBeCloseTo(-6.6667, 2);
  });

  it("portfolio_summary returns zeros for empty portfolio", async () => {
    mockReadJsonFile.mockResolvedValueOnce({ holdings: [], updatedAt: "" });

    const handler = registeredTools.get("portfolio_summary")!.handler;
    const result = await handler({});
    const parsed = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

    expect(parsed.totalMarketValue).toBe(0);
    expect(parsed.totalCost).toBe(0);
    expect(parsed.holdings).toHaveLength(0);
  });

  it("watchlist_get returns symbol array", async () => {
    mockReadJsonFile.mockResolvedValueOnce(["7203.T", "6758.T"]);

    const handler = registeredTools.get("watchlist_get")!.handler;
    const result = await handler({});
    const parsed = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

    expect(parsed).toEqual(["7203.T", "6758.T"]);
  });

  it("watchlist_set writes symbols", async () => {
    mockWriteJsonFile.mockResolvedValueOnce(undefined);

    const handler = registeredTools.get("watchlist_set")!.handler;
    const result = await handler({ symbols: ["7203.T", "9984.T"] });
    const parsed = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

    expect(parsed.success).toBe(true);
    expect(parsed.symbols).toEqual(["7203.T", "9984.T"]);
    expect(mockWriteJsonFile).toHaveBeenCalledWith("watchlist.json", ["7203.T", "9984.T"]);
  });
});
