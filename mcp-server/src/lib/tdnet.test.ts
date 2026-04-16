import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getDisclosuresByDate, getDisclosuresBySymbol, getRecentDisclosures } from "./tdnet.js";

describe("tdnet", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const sampleTdnetResponse = {
    total_count: 1,
    items: [
      {
        Tdnet: {
          id: "20240101-001",
          pubdate: "2024-01-15T09:00:00+09:00",
          company_code: "72030",
          company_name: "トヨタ自動車株式会社",
          title: "2024年3月期 第3四半期決算短信",
          document_url: "https://example.com/doc.pdf",
          markets_string: "東証プライム",
        },
      },
    ],
  };

  it("getDisclosuresByDate fetches disclosures for a given date", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(sampleTdnetResponse),
    });

    const result = await getDisclosuresByDate("20240115", 50);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://webapi.yanoshin.jp/webapi/tdnet/list/20240115.json?limit=50",
    );
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe("7203.T");
    expect(result[0].companyName).toBe("トヨタ自動車株式会社");
    expect(result[0].documentType).toBe("earnings");
    expect(result[0].type).toBe("disclosure");
  });

  it("getDisclosuresBySymbol fetches disclosures for a symbol", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(sampleTdnetResponse),
    });

    const result = await getDisclosuresBySymbol("7203.T", 20);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://webapi.yanoshin.jp/webapi/tdnet/list/7203.json?limit=20",
    );
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe("7203.T");
  });

  it("getRecentDisclosures fetches recent disclosures", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(sampleTdnetResponse),
    });

    const result = await getRecentDisclosures(10);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://webapi.yanoshin.jp/webapi/tdnet/list/recent.json?limit=10",
    );
    expect(result).toHaveLength(1);
  });

  it("classifies document types correctly", async () => {
    const items = [
      { Tdnet: { id: "1", pubdate: "2024-01-01", company_code: "10000", company_name: "A", title: "業績予想の修正", document_url: "", markets_string: null } },
      { Tdnet: { id: "2", pubdate: "2024-01-01", company_code: "20000", company_name: "B", title: "受注に関するお知らせ", document_url: "", markets_string: null } },
      { Tdnet: { id: "3", pubdate: "2024-01-01", company_code: "30000", company_name: "C", title: "株式分割のお知らせ", document_url: "", markets_string: null } },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ total_count: 3, items }),
    });

    const result = await getRecentDisclosures();
    expect(result[0].documentType).toBe("revision");
    expect(result[1].documentType).toBe("order");
    expect(result[2].documentType).toBe("other");
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(getRecentDisclosures()).rejects.toThrow("TDnet API error: 500");
  });
});
