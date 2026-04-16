/**
 * SEC EDGAR API クライアント
 * 米国企業の公式開示書類（10-K, 10-Q）取得
 * 公開 API — User-Agent ヘッダー必須
 */

const EDGAR_BASE_URL = "https://efts.sec.gov/LATEST";
const EDGAR_DATA_URL = "https://data.sec.gov";

// === 型定義 ===

export interface EdgarFiling {
  accessionNumber: string;
  filingDate: string;
  reportDate: string;
  form: string;
  primaryDocument: string;
  primaryDocDescription: string;
  fileUrl: string;
}

export interface EdgarCompany {
  cik: string;
  entityName: string;
  ticker: string;
}

export interface EdgarFilingDetail {
  accessionNumber: string;
  form: string;
  filingDate: string;
  content: string; // 抽出されたテキスト
}

// === ヘルパー ===

const USER_AGENT = "StockAnalyzeCLI/1.0 (contact@example.com)";

async function edgarFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`SEC EDGAR API error: ${res.status} ${errorText}`);
  }

  return res.json();
}

async function edgarFetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`SEC EDGAR fetch error: ${res.status}`);
  }

  return res.text();
}

// === 公開関数 ===

/**
 * ティッカーシンボルから CIK を検索
 */
export async function searchCompanyCIK(ticker: string): Promise<EdgarCompany | null> {
  const url = `${EDGAR_BASE_URL}/search-index?q=${encodeURIComponent(ticker)}&dateRange=custom&startdt=2020-01-01&forms=10-K`;

  try {
    // Full-text search API で CIK を取得
    const data = await edgarFetch<{
      hits: { hits: { _source: { entity_name: string; file_num: string } }[] };
    }>(url);

    if (data.hits?.hits?.length > 0) {
      const hit = data.hits.hits[0]._source;
      return {
        cik: hit.file_num,
        entityName: hit.entity_name,
        ticker: ticker.toUpperCase(),
      };
    }
  } catch {
    // フォールバック: company tickers JSON
  }

  // フォールバック: tickers JSON から検索
  try {
    const tickersData = await edgarFetch<Record<string, { cik_str: number; title: string }>>(
      `${EDGAR_DATA_URL}/company_tickers.json`,
    );

    const upperTicker = ticker.toUpperCase();
    for (const entry of Object.values(tickersData)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = entry as any;
      if (e.ticker === upperTicker) {
        return {
          cik: String(e.cik_str).padStart(10, "0"),
          entityName: e.title,
          ticker: upperTicker,
        };
      }
    }
  } catch {
    // 両方失敗した場合
  }

  return null;
}

/**
 * 企業の開示書類一覧を取得
 */
export async function getCompanyFilings(
  cik: string,
  formType?: "10-K" | "10-Q" | "8-K",
  limit = 10,
): Promise<EdgarFiling[]> {
  const paddedCik = cik.padStart(10, "0");
  const url = `${EDGAR_DATA_URL}/submissions/CIK${paddedCik}.json`;

  const data = await edgarFetch<{
    cik: string;
    entityType: string;
    name: string;
    filings: {
      recent: {
        accessionNumber: string[];
        filingDate: string[];
        reportDate: string[];
        form: string[];
        primaryDocument: string[];
        primaryDocDescription: string[];
      };
    };
  }>(url);

  const recent = data.filings.recent;
  const filings: EdgarFiling[] = [];

  for (let i = 0; i < recent.accessionNumber.length && filings.length < limit; i++) {
    if (formType && recent.form[i] !== formType) continue;

    const accession = recent.accessionNumber[i].replace(/-/g, "");
    filings.push({
      accessionNumber: recent.accessionNumber[i],
      filingDate: recent.filingDate[i],
      reportDate: recent.reportDate[i],
      form: recent.form[i],
      primaryDocument: recent.primaryDocument[i],
      primaryDocDescription: recent.primaryDocDescription[i] || recent.form[i],
      fileUrl: `${EDGAR_DATA_URL}/Archives/edgar/data/${paddedCik}/${accession}/${recent.primaryDocument[i]}`,
    });
  }

  return filings;
}

/**
 * 開示書類のテキストを取得（HTML をプレーンテキストに変換）
 */
export async function getFilingContent(
  fileUrl: string,
  maxLength = 8000,
): Promise<string> {
  const html = await edgarFetchText(fileUrl);

  // HTML タグの除去（簡易的な変換）
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

  if (text.length > maxLength) {
    return text.slice(0, maxLength) + "\n...(truncated)";
  }

  return text;
}

/**
 * 10-K のビジネス記述セクション（Item 1）を抽出
 */
export async function getBusinessDescription(
  cik: string,
): Promise<{ filingDate: string; content: string } | null> {
  const filings = await getCompanyFilings(cik, "10-K", 1);
  if (filings.length === 0) return null;

  const filing = filings[0];
  const fullText = await getFilingContent(filing.fileUrl, 20000);

  // Item 1 (Business) セクションの抽出を試みる
  const item1Match = fullText.match(
    /(?:ITEM\s*1[.\s]*(?:BUSINESS|Description of Business))[\s.]*(.{500,8000}?)(?:ITEM\s*(?:1A|2))/i,
  );

  return {
    filingDate: filing.filingDate,
    content: item1Match ? item1Match[1].trim() : fullText.slice(0, 8000),
  };
}
