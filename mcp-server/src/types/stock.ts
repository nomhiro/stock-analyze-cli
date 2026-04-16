export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  marketState: string;
  exchange: string;
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  volume?: number;
  marketCap?: number;
  trailingPE?: number;
  priceToBook?: number;
  dividendYield?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  epsTrailingTwelveMonths?: number;
  regularMarketTime?: string;
  netCashRatio?: number | null;
}

export interface StockHistoryEntry {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

export type HistoryInterval = "1d" | "1wk" | "1mo";

export interface IncomeStatementEntry {
  endDate: string;
  totalRevenue: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
}

export interface QuarterlyEarningsEntry {
  date: string;
  revenue: number | null;
  earnings: number | null;
}

export interface StockFundamentalsDetail {
  symbol: string;
  sector: string | null;
  industry: string | null;
  netCashRatio: number | null;
  roe: number | null;
  payoutRatio: number | null;
  forwardPE: number | null;
  evToEbitda: number | null;
  eps: number | null;
  bps: number | null;
  revenueYoY: number | null;
  earningsYoY: number | null;
  incomeStatements: IncomeStatementEntry[];
  quarterlyEarnings: QuarterlyEarningsEntry[];
}

export interface ScreeningFilter {
  perMax?: number;
  pbrMax?: number;
  marketCapMin?: number;
  dividendYieldMin?: number;
}

export interface DisclosureEvent {
  type: "disclosure";
  id: string;
  symbol: string;
  companyName: string;
  title: string;
  documentType: "earnings" | "revision" | "order" | "other";
  publishedAt: string;
  documentUrl?: string;
  analyzed: boolean;
}
