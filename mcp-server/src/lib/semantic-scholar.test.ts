import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchPapers, getPaperDetail, detectCitationBurst } from "./semantic-scholar.js";
import type { FieldTrendEntry } from "./semantic-scholar.js";

describe("semantic-scholar", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const samplePaper = {
    paperId: "abc123",
    title: "Deep Learning for Stock Prediction",
    abstract: "We propose a novel approach...",
    year: 2023,
    citationCount: 150,
    influentialCitationCount: 20,
    publicationDate: "2023-06-15",
    journal: { name: "Nature Machine Intelligence" },
    fieldsOfStudy: ["Computer Science"],
    url: "https://semanticscholar.org/paper/abc123",
    authors: [{ authorId: "auth1", name: "John Doe" }],
  };

  it("searchPapers returns search results", async () => {
    const mockResult = {
      total: 100,
      offset: 0,
      data: [samplePaper],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResult),
    });

    const result = await searchPapers("deep learning stock", { limit: 5 });

    expect(result.total).toBe(100);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].title).toBe("Deep Learning for Stock Prediction");

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/paper/search");
    expect(calledUrl).toContain("query=deep+learning+stock");
    expect(calledUrl).toContain("limit=5");
  });

  it("searchPapers includes year filter", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ total: 0, offset: 0, data: [] }),
    });

    await searchPapers("AI", { year: "2020-2025" });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("year=2020-2025");
  });

  it("searchPapers includes API key when available", async () => {
    vi.stubEnv("SEMANTIC_SCHOLAR_API_KEY", "s2-key-test");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ total: 0, offset: 0, data: [] }),
    });

    await searchPapers("test");

    const calledHeaders = mockFetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(calledHeaders["x-api-key"]).toBe("s2-key-test");
  });

  it("getPaperDetail fetches paper details with citations", async () => {
    const detailPaper = {
      ...samplePaper,
      citations: [
        { paperId: "cit1", title: "Follow-up study", year: 2024 },
      ],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(detailPaper),
    });

    const result = await getPaperDetail("abc123");

    expect(result.paperId).toBe("abc123");
    expect(result.citations).toHaveLength(1);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/paper/abc123");
    expect(calledUrl).toContain("citations");
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: () => Promise.resolve("Rate limit exceeded"),
    });

    await expect(searchPapers("test")).rejects.toThrow("Semantic Scholar API error: 429");
  });
});

describe("detectCitationBurst", () => {
  it("detects citation burst when growth exceeds threshold", () => {
    const trend: FieldTrendEntry[] = [
      { year: 2021, paperCount: 100, totalCitations: 500 },
      { year: 2022, paperCount: 150, totalCitations: 800 },
      { year: 2023, paperCount: 300, totalCitations: 2000 },
    ];

    const result = detectCitationBurst(trend, 1.5);

    expect(result.detected).toBe(true);
    expect(result.peakYear).toBe(2023);
    expect(result.growthRate).toBe(150); // 2000/800 = 2.5 => 150%
  });

  it("returns false for gradual growth", () => {
    const trend: FieldTrendEntry[] = [
      { year: 2021, paperCount: 100, totalCitations: 500 },
      { year: 2022, paperCount: 110, totalCitations: 550 },
      { year: 2023, paperCount: 120, totalCitations: 600 },
    ];

    const result = detectCitationBurst(trend, 1.5);

    expect(result.detected).toBe(false);
  });

  it("handles single entry trend", () => {
    const trend: FieldTrendEntry[] = [
      { year: 2023, paperCount: 100, totalCitations: 500 },
    ];

    const result = detectCitationBurst(trend);

    expect(result.detected).toBe(false);
    expect(result.peakYear).toBeNull();
    expect(result.growthRate).toBeNull();
  });

  it("handles empty trend", () => {
    const result = detectCitationBurst([]);

    expect(result.detected).toBe(false);
  });
});
