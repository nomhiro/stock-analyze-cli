export interface BalanceSheetData {
  totalCurrentAssets: number;
  longTermInvestments: number;
  totalLiab: number;
}

export function calculateNetCashRatio(
  bs: BalanceSheetData,
  marketCap: number,
): number | null {
  if (marketCap <= 0) return null;
  const netCash = bs.totalCurrentAssets + bs.longTermInvestments * 0.7 - bs.totalLiab;
  return netCash / marketCap;
}
