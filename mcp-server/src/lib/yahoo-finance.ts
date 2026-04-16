import YahooFinance from "yahoo-finance2";
import { readJsonFile } from "./json-store.js";
import type {
  StockQuote,
  StockHistoryEntry,
  StockSearchResult,
  StockFundamentalsDetail,
  IncomeStatementEntry,
  QuarterlyEarningsEntry,
  HistoryInterval,
} from "../types/stock.js";
import { calculateNetCashRatio, type BalanceSheetData } from "./net-cash-ratio.js";

// Singleton YahooFinance instance
let yahooFinanceInstance: InstanceType<typeof YahooFinance> | null = null;

function getYahooFinance(): InstanceType<typeof YahooFinance> {
  if (!yahooFinanceInstance) {
    yahooFinanceInstance = new YahooFinance({
      validation: { logErrors: false },
      suppressNotices: ["yahooSurvey"],
    });
  }
  return yahooFinanceInstance;
}

// TSE name cache (loaded from JSON file once)
let tseNameCache: Record<string, string> | null = null;

async function getTseName(symbol: string): Promise<string> {
  if (!tseNameCache) {
    tseNameCache = await readJsonFile<Record<string, string>>("static/tse-names.json", {});
  }
  const code = symbol.replace(".T", "");
  return tseNameCache[symbol] || tseNameCache[code] || "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeGet(obj: any, key: string): any {
  return obj?.[key];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function mapQuote(quote: any, fallbackSymbol?: string): Promise<StockQuote> {
  const sym = (safeGet(quote, "symbol") as string) ?? fallbackSymbol ?? "";
  return {
    symbol: sym,
    name:
      (await getTseName(sym)) ||
      (safeGet(quote, "shortName") as string) ||
      (safeGet(quote, "longName") as string) ||
      sym,
    price: (safeGet(quote, "regularMarketPrice") as number) ?? 0,
    change: (safeGet(quote, "regularMarketChange") as number) ?? 0,
    changePercent: (safeGet(quote, "regularMarketChangePercent") as number) ?? 0,
    currency: (safeGet(quote, "currency") as string) ?? "JPY",
    marketState: (safeGet(quote, "marketState") as string) ?? "CLOSED",
    exchange: (safeGet(quote, "fullExchangeName") as string) ?? "",
    open: safeGet(quote, "regularMarketOpen") as number | undefined,
    high: safeGet(quote, "regularMarketDayHigh") as number | undefined,
    low: safeGet(quote, "regularMarketDayLow") as number | undefined,
    previousClose: safeGet(quote, "regularMarketPreviousClose") as number | undefined,
    volume: safeGet(quote, "regularMarketVolume") as number | undefined,
    marketCap: safeGet(quote, "marketCap") as number | undefined,
    trailingPE: safeGet(quote, "trailingPE") as number | undefined,
    priceToBook: safeGet(quote, "priceToBook") as number | undefined,
    dividendYield: safeGet(quote, "dividendYield") as number | undefined,
    fiftyTwoWeekHigh: safeGet(quote, "fiftyTwoWeekHigh") as number | undefined,
    fiftyTwoWeekLow: safeGet(quote, "fiftyTwoWeekLow") as number | undefined,
    epsTrailingTwelveMonths: safeGet(quote, "epsTrailingTwelveMonths") as number | undefined,
    regularMarketTime: safeGet(quote, "regularMarketTime")
      ? new Date(safeGet(quote, "regularMarketTime") as string | number).toISOString()
      : undefined,
  };
}

const BATCH_SIZE = 500;

export async function getQuote(symbol: string): Promise<StockQuote> {
  const quote = await getYahooFinance().quote(symbol, { lang: "ja-JP", region: "JP" });
  return mapQuote(quote, symbol);
}

export async function getQuotes(symbols: string[]): Promise<StockQuote[]> {
  if (symbols.length === 0) return [];
  const batches: string[][] = [];
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    batches.push(symbols.slice(i, i + BATCH_SIZE));
  }
  const batchResults: StockQuote[][] = [];
  for (const batch of batches) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = (await getYahooFinance().quote(batch, { lang: "ja-JP", region: "JP" })) as any[];
    batchResults.push(await Promise.all(results.map((q) => mapQuote(q))));
  }
  return batchResults.flat();
}

export async function getHistory(
  symbol: string,
  period1: string,
  period2?: string,
  interval: HistoryInterval = "1d",
): Promise<StockHistoryEntry[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await getYahooFinance().chart(symbol, {
    period1,
    period2: period2 || new Date().toISOString().split("T")[0],
    interval,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (result.quotes || []).map((q: any) => ({
    date: new Date(q.date).toISOString().split("T")[0],
    open: q.open ?? 0,
    high: q.high ?? 0,
    low: q.low ?? 0,
    close: q.close ?? 0,
    volume: q.volume ?? 0,
  }));
}

export async function searchStocks(query: string): Promise<StockSearchResult[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result: any;
  try {
    result = await getYahooFinance().search(query, { lang: "ja-JP", region: "JP" });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "BadRequestError") {
      return [];
    }
    throw error;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (result.quotes || [])
    .filter((q: any) => q.quoteType === "EQUITY")
    .map((q: any) => ({
      symbol: q.symbol,
      name: tseNameCache?.[q.symbol] || q.shortname || q.longname || q.symbol,
      exchange: q.exchange || "",
      type: q.quoteType || "EQUITY",
    }));
}

export async function getStockFundamentals(symbol: string): Promise<StockFundamentalsDetail> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summary: any = await getYahooFinance().quoteSummary(symbol, {
    modules: ["defaultKeyStatistics", "financialData", "assetProfile"],
  });

  const stats = summary?.defaultKeyStatistics ?? {};
  const financial = summary?.financialData ?? {};
  const assetProfile = summary?.assetProfile ?? {};

  const [bsResult, annualResult, quarterlyResult] = await Promise.allSettled([
    fetchBalanceSheetData(symbol),
    fetchAnnualIncomeData(symbol),
    fetchQuarterlyIncomeData(symbol),
  ]);

  const bsData = bsResult.status === "fulfilled" ? bsResult.value : null;
  const incomeStatements = annualResult.status === "fulfilled" ? annualResult.value : [];
  const quarterlyEarnings = quarterlyResult.status === "fulfilled" ? quarterlyResult.value : [];

  let netCashRatio: number | null = null;
  const marketCap = (safeGet(stats, "marketCap") as number) ?? (safeGet(financial, "marketCap") as number);
  if (bsData && marketCap) {
    netCashRatio = calculateNetCashRatio(bsData, marketCap);
  }

  let revenueYoY: number | null = null;
  let earningsYoY: number | null = null;
  if (incomeStatements.length >= 2) {
    const latest = incomeStatements[incomeStatements.length - 1];
    const previous = incomeStatements[incomeStatements.length - 2];
    if (latest.totalRevenue && previous.totalRevenue && previous.totalRevenue !== 0) {
      revenueYoY = (latest.totalRevenue - previous.totalRevenue) / Math.abs(previous.totalRevenue);
    }
    if (latest.netIncome && previous.netIncome && previous.netIncome !== 0) {
      earningsYoY = (latest.netIncome - previous.netIncome) / Math.abs(previous.netIncome);
    }
  }

  return {
    symbol,
    sector: (safeGet(assetProfile, "sector") as string) ?? null,
    industry: (safeGet(assetProfile, "industry") as string) ?? null,
    netCashRatio,
    roe: (safeGet(financial, "returnOnEquity") as number) ?? null,
    payoutRatio: (safeGet(stats, "payoutRatio") as number) ?? null,
    forwardPE: (safeGet(stats, "forwardPE") as number) ?? null,
    evToEbitda: (safeGet(stats, "enterpriseToEbitda") as number) ?? null,
    eps: (safeGet(stats, "trailingEps") as number) ?? null,
    bps: (safeGet(stats, "bookValue") as number) ?? null,
    revenueYoY,
    earningsYoY,
    incomeStatements,
    quarterlyEarnings,
  };
}

async function fetchBalanceSheetData(symbol: string): Promise<BalanceSheetData | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries: any[] = await getYahooFinance().fundamentalsTimeSeries(symbol, {
    period1: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    type: "quarterly",
    module: "balance-sheet",
  });
  if (!entries || entries.length === 0) return null;
  const latest = entries[entries.length - 1];
  const currentAssets = safeGet(latest, "currentAssets") as number | undefined;
  const totalLiabilities = safeGet(latest, "totalLiabilitiesNetMinorityInterest") as number | undefined;
  if (currentAssets == null || totalLiabilities == null) return null;
  return {
    totalCurrentAssets: currentAssets,
    longTermInvestments: (safeGet(latest, "investmentinFinancialAssets") as number) ?? 0,
    totalLiab: totalLiabilities,
  };
}

async function fetchAnnualIncomeData(symbol: string): Promise<IncomeStatementEntry[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries: any[] = await getYahooFinance().fundamentalsTimeSeries(symbol, {
    period1: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    type: "annual",
    module: "financials",
  });
  if (!entries || entries.length === 0) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return entries.map((entry: any) => ({
    endDate: entry.date ? new Date(entry.date).toISOString().split("T")[0] : "",
    totalRevenue: (safeGet(entry, "totalRevenue") as number) ?? null,
    operatingIncome: (safeGet(entry, "operatingIncome") as number) ?? null,
    netIncome: (safeGet(entry, "netIncome") as number) ?? null,
  }));
}

async function fetchQuarterlyIncomeData(symbol: string): Promise<QuarterlyEarningsEntry[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries: any[] = await getYahooFinance().fundamentalsTimeSeries(symbol, {
    period1: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    type: "quarterly",
    module: "financials",
  });
  if (!entries || entries.length === 0) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return entries.map((entry: any) => ({
    date: entry.date ? new Date(entry.date).toISOString().split("T")[0] : "",
    revenue: (safeGet(entry, "totalRevenue") as number) ?? null,
    earnings: (safeGet(entry, "netIncome") as number) ?? null,
  }));
}

export async function getSectors(
  symbols: string[],
  concurrency = 5,
): Promise<Record<string, { sector: string | null; industry: string | null }>> {
  const result: Record<string, { sector: string | null; industry: string | null }> = {};
  for (let i = 0; i < symbols.length; i += concurrency) {
    const batch = symbols.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      batch.map(async (symbol) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const summary: any = await getYahooFinance().quoteSummary(symbol, {
          modules: ["assetProfile"],
        });
        const profile = summary?.assetProfile ?? {};
        return {
          sector: (safeGet(profile, "sector") as string) ?? null,
          industry: (safeGet(profile, "industry") as string) ?? null,
        };
      }),
    );
    settled.forEach((s, idx) => {
      result[batch[idx]] = s.status === "fulfilled" ? s.value : { sector: null, industry: null };
    });
  }
  return result;
}

export async function enrichWithNetCashRatio(
  stocks: StockQuote[],
  concurrency = 10,
): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>();
  for (let i = 0; i < stocks.length; i += concurrency) {
    const batch = stocks.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      batch.map(async (stock) => {
        if (!stock.marketCap) return null;
        const bsData = await fetchBalanceSheetData(stock.symbol);
        if (!bsData) return null;
        return calculateNetCashRatio(bsData, stock.marketCap);
      }),
    );
    settled.forEach((s, idx) => {
      result.set(batch[idx].symbol, s.status === "fulfilled" ? s.value : null);
    });
  }
  return result;
}
