/**
 * Financial Modeling Prep (FMP) API クライアント
 * 米国株の財務データ取得に使用
 */

const FMP_BASE_URL = "https://financialmodelingprep.com/api/v3";

// === 型定義 ===

export interface FMPQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changesPercentage: number;
  marketCap: number;
  pe: number | null;
  priceToBook: number | null;
  volume: number;
  avgVolume: number;
  exchange: string;
  earningsAnnouncement: string | null;
}

export interface FMPIncomeStatement {
  date: string;
  symbol: string;
  revenue: number;
  grossProfit: number;
  grossProfitRatio: number;
  operatingIncome: number;
  operatingIncomeRatio: number;
  netIncome: number;
  netIncomeRatio: number;
  eps: number;
  ebitda: number;
}

export interface FMPBalanceSheet {
  date: string;
  symbol: string;
  totalAssets: number;
  totalLiabilities: number;
  totalStockholdersEquity: number;
  cashAndCashEquivalents: number;
  totalDebt: number;
}

export interface FMPCashFlow {
  date: string;
  symbol: string;
  operatingCashFlow: number;
  capitalExpenditure: number;
  freeCashFlow: number;
}

export interface FMPGrowthMetrics {
  symbol: string;
  revenueGrowth: number | null;
  grossProfitGrowth: number | null;
  epsgrowth: number | null;
  operatingIncomeGrowth: number | null;
  freeCashFlowGrowth: number | null;
}

export interface FMPSearchResult {
  symbol: string;
  name: string;
  currency: string;
  stockExchange: string;
  exchangeShortName: string;
}

// === ヘルパー ===

function getApiKey(): string {
  const key = process.env.FMP_API_KEY;
  if (!key) throw new Error("FMP_API_KEY is not configured");
  return key;
}

async function fmpFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${FMP_BASE_URL}${path}`);
  url.searchParams.set("apikey", getApiKey());
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`FMP API error: ${res.status} ${errorText}`);
  }

  return res.json();
}

// === 公開関数 ===

/** リアルタイム株価取得 */
export async function getFMPQuote(symbol: string): Promise<FMPQuote | null> {
  const data = await fmpFetch<FMPQuote[]>(`/quote/${encodeURIComponent(symbol)}`);
  return data?.[0] ?? null;
}

/** 複数銘柄の株価取得 */
export async function getFMPQuotes(symbols: string[]): Promise<FMPQuote[]> {
  if (symbols.length === 0) return [];
  const data = await fmpFetch<FMPQuote[]>(
    `/quote/${symbols.map(s => encodeURIComponent(s)).join(",")}`,
  );
  return data ?? [];
}

/** 年次損益計算書（直近5年） */
export async function getFMPIncomeStatements(
  symbol: string,
  period: "annual" | "quarter" = "annual",
  limit = 5,
): Promise<FMPIncomeStatement[]> {
  return fmpFetch<FMPIncomeStatement[]>(
    `/income-statement/${encodeURIComponent(symbol)}`,
    { period, limit: String(limit) },
  );
}

/** 年次貸借対照表（直近5年） */
export async function getFMPBalanceSheet(
  symbol: string,
  period: "annual" | "quarter" = "annual",
  limit = 5,
): Promise<FMPBalanceSheet[]> {
  return fmpFetch<FMPBalanceSheet[]>(
    `/balance-sheet-statement/${encodeURIComponent(symbol)}`,
    { period, limit: String(limit) },
  );
}

/** キャッシュフロー計算書 */
export async function getFMPCashFlow(
  symbol: string,
  period: "annual" | "quarter" = "annual",
  limit = 5,
): Promise<FMPCashFlow[]> {
  return fmpFetch<FMPCashFlow[]>(
    `/cash-flow-statement/${encodeURIComponent(symbol)}`,
    { period, limit: String(limit) },
  );
}

/** 成長指標（前年比） */
export async function getFMPGrowthMetrics(
  symbol: string,
  limit = 3,
): Promise<FMPGrowthMetrics[]> {
  return fmpFetch<FMPGrowthMetrics[]>(
    `/financial-growth/${encodeURIComponent(symbol)}`,
    { limit: String(limit) },
  );
}

/** 銘柄検索 */
export async function searchFMPStocks(query: string, limit = 10): Promise<FMPSearchResult[]> {
  return fmpFetch<FMPSearchResult[]>("/search", {
    query,
    limit: String(limit),
    exchange: "NASDAQ,NYSE",
  });
}

/**
 * 米国株の主要財務指標をまとめて取得
 */
export async function getFMPFinancialSummary(symbol: string) {
  const [quote, income, balance, cashFlow, growth] = await Promise.allSettled([
    getFMPQuote(symbol),
    getFMPIncomeStatements(symbol, "annual", 3),
    getFMPBalanceSheet(symbol, "annual", 1),
    getFMPCashFlow(symbol, "annual", 1),
    getFMPGrowthMetrics(symbol, 1),
  ]);

  return {
    quote: quote.status === "fulfilled" ? quote.value : null,
    incomeStatements: income.status === "fulfilled" ? income.value : [],
    balanceSheet: balance.status === "fulfilled" ? balance.value?.[0] ?? null : null,
    cashFlow: cashFlow.status === "fulfilled" ? cashFlow.value?.[0] ?? null : null,
    growth: growth.status === "fulfilled" ? growth.value?.[0] ?? null : null,
  };
}
