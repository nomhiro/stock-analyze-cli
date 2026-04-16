import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerMarketTools } from "./market.js";

// Mock yahoo-finance
vi.mock("../lib/yahoo-finance.js", () => ({
  getQuote: vi.fn(),
  getQuotes: vi.fn(),
}));

import { getQuote, getQuotes } from "../lib/yahoo-finance.js";

const mockGetQuote = vi.mocked(getQuote);
const mockGetQuotes = vi.mocked(getQuotes);

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

  it("registers both market tools", () => {
    expect(mockServer.tool).toHaveBeenCalledTimes(2);
    expect(registeredTools.has("market_quote")).toBe(true);
    expect(registeredTools.has("market_quotes")).toBe(true);
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
});
