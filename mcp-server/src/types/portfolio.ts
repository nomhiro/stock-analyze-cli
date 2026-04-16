export const ACCOUNT_TYPES = [
  "つみたて投資枠",
  "成長投資枠",
  "特定口座",
  "一般口座",
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export interface PortfolioHolding {
  symbol: string;
  shares: number;
  averageCost: number;
  accountType?: AccountType;
  acquiredAt?: string;
  memo?: string;
}

export interface PortfolioData {
  holdings: PortfolioHolding[];
  updatedAt: string;
}

export interface EnrichedHolding extends PortfolioHolding {
  name?: string;
  currentPrice?: number;
  change?: number;
  changePercent?: number;
  marketValue?: number;
  unrealizedGain?: number;
  unrealizedGainPercent?: number;
}

export interface PortfolioSummary {
  totalMarketValue: number;
  totalCost: number;
  totalUnrealizedGain: number;
  totalUnrealizedGainPercent: number;
  holdings: EnrichedHolding[];
}
