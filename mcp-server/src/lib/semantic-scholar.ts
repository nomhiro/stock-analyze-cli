/**
 * Semantic Scholar API クライアント
 * 学術論文の引用トレンド分析に使用
 * API制限: 100 requests/5min（認証なし）
 */

const S2_BASE_URL = "https://api.semanticscholar.org/graph/v1";

// === 型定義 ===

export interface S2Paper {
  paperId: string;
  title: string;
  abstract: string | null;
  year: number | null;
  citationCount: number;
  influentialCitationCount: number;
  publicationDate: string | null;
  journal?: { name: string } | null;
  fieldsOfStudy?: string[] | null;
  url: string;
  authors: { authorId: string; name: string }[];
}

export interface S2SearchResult {
  total: number;
  offset: number;
  data: S2Paper[];
}

export interface S2CitationsByYear {
  year: number;
  citationCount: number;
}

export interface S2PaperDetail extends S2Paper {
  citations: { paperId: string; title: string; year: number | null }[];
  citationsByYear?: Record<string, number>;
}

export interface FieldTrendEntry {
  year: number;
  paperCount: number;
  totalCitations: number;
}

export interface SearchPapersOptions {
  limit?: number;
  offset?: number;
  year?: string; // "2020-2025" or "2023-"
  fieldsOfStudy?: string[];
  minCitationCount?: number;
}

// === ヘルパー ===

async function s2Fetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${S2_BASE_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  // 任意: API キーがあればレート制限が緩和される
  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  const res = await fetch(url.toString(), {
    headers,
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Semantic Scholar API error: ${res.status} ${errorText}`);
  }

  return res.json();
}

// === 公開関数 ===

const PAPER_FIELDS = "paperId,title,abstract,year,citationCount,influentialCitationCount,publicationDate,journal,fieldsOfStudy,url,authors";

/** 論文検索 */
export async function searchPapers(
  query: string,
  options?: SearchPapersOptions,
): Promise<S2SearchResult> {
  const params: Record<string, string> = {
    query,
    fields: PAPER_FIELDS,
    limit: String(options?.limit ?? 10),
    offset: String(options?.offset ?? 0),
  };

  if (options?.year) params.year = options.year;
  if (options?.fieldsOfStudy?.length) {
    params.fieldsOfStudy = options.fieldsOfStudy.join(",");
  }
  if (options?.minCitationCount !== undefined) {
    params.minCitationCount = String(options.minCitationCount);
  }

  return s2Fetch<S2SearchResult>("/paper/search", params);
}

/** 論文の詳細情報（引用リスト含む） */
export async function getPaperDetail(paperId: string): Promise<S2PaperDetail> {
  return s2Fetch<S2PaperDetail>(
    `/paper/${encodeURIComponent(paperId)}`,
    { fields: `${PAPER_FIELDS},citations.paperId,citations.title,citations.year` },
  );
}

/**
 * 特定クエリの年次引用トレンドを分析
 * 直近数年の論文数と引用数の推移からCitation Burstを検出
 */
export async function getFieldTrend(
  query: string,
  startYear: number,
  endYear: number,
): Promise<FieldTrendEntry[]> {
  const results: FieldTrendEntry[] = [];

  // 各年のデータを並列取得（最大5年分）
  const years = [];
  for (let y = startYear; y <= endYear; y++) years.push(y);

  const yearResults = await Promise.allSettled(
    years.map(async (year) => {
      const data = await searchPapers(query, {
        year: `${year}-${year}`,
        limit: 1,
      });
      // total は検索結果の総数（≒ その年の論文数の近似）
      // 上位論文の引用数合計を取得するため追加クエリ
      const topPapers = await searchPapers(query, {
        year: `${year}-${year}`,
        limit: 20,
      });

      const totalCitations = topPapers.data.reduce(
        (sum, p) => sum + (p.citationCount ?? 0),
        0,
      );

      return {
        year,
        paperCount: data.total,
        totalCitations,
      };
    }),
  );

  for (const r of yearResults) {
    if (r.status === "fulfilled") {
      results.push(r.value);
    }
  }

  return results.sort((a, b) => a.year - b.year);
}

/**
 * Citation Burst の検出
 * 前年比で引用数が急増しているかを判定
 */
export function detectCitationBurst(
  trend: FieldTrendEntry[],
  threshold = 1.5,
): { detected: boolean; peakYear: number | null; growthRate: number | null } {
  if (trend.length < 2) return { detected: false, peakYear: null, growthRate: null };

  let maxGrowth = 0;
  let peakYear: number | null = null;

  for (let i = 1; i < trend.length; i++) {
    const prev = trend[i - 1].totalCitations;
    const curr = trend[i].totalCitations;
    if (prev > 0) {
      const growth = curr / prev;
      if (growth > maxGrowth) {
        maxGrowth = growth;
        peakYear = trend[i].year;
      }
    }
  }

  return {
    detected: maxGrowth >= threshold,
    peakYear,
    growthRate: maxGrowth > 0 ? Math.round((maxGrowth - 1) * 100) : null,
  };
}
