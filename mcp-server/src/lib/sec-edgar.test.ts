import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchCompanyCIK, getCompanyFilings, getFilingContent } from "./sec-edgar.js";

describe("sec-edgar", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("searchCompanyCIK finds company via search-index", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        hits: {
          hits: [
            { _source: { entity_name: "APPLE INC", file_num: "0000320193" } },
          ],
        },
      }),
    });

    const result = await searchCompanyCIK("AAPL");

    expect(result).toEqual({
      cik: "0000320193",
      entityName: "APPLE INC",
      ticker: "AAPL",
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("search-index");
    expect(calledUrl).toContain("AAPL");
  });

  it("searchCompanyCIK falls back to tickers JSON", async () => {
    // First call (search-index) fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Server error"),
    });

    // Fallback call (company_tickers.json)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        "0": { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." },
        "1": { cik_str: 789019, ticker: "MSFT", title: "Microsoft Corporation" },
      }),
    });

    const result = await searchCompanyCIK("AAPL");

    expect(result).toEqual({
      cik: "0000320193",
      entityName: "Apple Inc.",
      ticker: "AAPL",
    });
  });

  it("searchCompanyCIK returns null when not found", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ hits: { hits: [] } }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        "0": { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." },
      }),
    });

    const result = await searchCompanyCIK("ZZZZZ");

    expect(result).toBeNull();
  });

  it("getCompanyFilings parses filings from submissions API", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        cik: "0000320193",
        entityType: "operating",
        name: "Apple Inc.",
        filings: {
          recent: {
            accessionNumber: ["0000320193-23-000106"],
            filingDate: ["2023-11-03"],
            reportDate: ["2023-09-30"],
            form: ["10-K"],
            primaryDocument: ["aapl-20230930.htm"],
            primaryDocDescription: ["10-K Annual Report"],
          },
        },
      }),
    });

    const result = await getCompanyFilings("0000320193", "10-K", 5);

    expect(result).toHaveLength(1);
    expect(result[0].form).toBe("10-K");
    expect(result[0].filingDate).toBe("2023-11-03");
    expect(result[0].fileUrl).toContain("Archives/edgar/data");
  });

  it("getCompanyFilings filters by form type", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        cik: "0000320193",
        entityType: "operating",
        name: "Apple Inc.",
        filings: {
          recent: {
            accessionNumber: ["acc-1", "acc-2"],
            filingDate: ["2023-11-03", "2023-08-04"],
            reportDate: ["2023-09-30", "2023-07-01"],
            form: ["10-K", "10-Q"],
            primaryDocument: ["doc1.htm", "doc2.htm"],
            primaryDocDescription: ["Annual Report", "Quarterly Report"],
          },
        },
      }),
    });

    const result = await getCompanyFilings("0000320193", "10-K", 5);

    expect(result).toHaveLength(1);
    expect(result[0].form).toBe("10-K");
  });

  it("getFilingContent strips HTML and truncates", async () => {
    const html = "<html><head><style>body{}</style></head><body><p>Hello &amp; World</p><script>alert('x')</script></body></html>";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(html),
    });

    const result = await getFilingContent("https://example.com/filing.htm", 100);

    expect(result).toContain("Hello & World");
    expect(result).not.toContain("<p>");
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert");
  });
});
