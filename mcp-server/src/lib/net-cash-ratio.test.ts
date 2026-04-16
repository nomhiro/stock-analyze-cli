import { describe, it, expect } from "vitest";
import { calculateNetCashRatio } from "./net-cash-ratio.js";

describe("calculateNetCashRatio", () => {
  it("calculates correct net cash ratio", () => {
    const bs = {
      totalCurrentAssets: 1000,
      longTermInvestments: 200,
      totalLiab: 500,
    };
    const result = calculateNetCashRatio(bs, 1000);
    // netCash = 1000 + 200*0.7 - 500 = 1000 + 140 - 500 = 640
    // ratio = 640 / 1000 = 0.64
    expect(result).toBeCloseTo(0.64, 2);
  });

  it("returns null for zero marketCap", () => {
    const bs = {
      totalCurrentAssets: 1000,
      longTermInvestments: 200,
      totalLiab: 500,
    };
    expect(calculateNetCashRatio(bs, 0)).toBeNull();
  });

  it("returns null for negative marketCap", () => {
    const bs = {
      totalCurrentAssets: 1000,
      longTermInvestments: 200,
      totalLiab: 500,
    };
    expect(calculateNetCashRatio(bs, -100)).toBeNull();
  });

  it("handles negative net cash (more liabilities than assets)", () => {
    const bs = {
      totalCurrentAssets: 100,
      longTermInvestments: 50,
      totalLiab: 800,
    };
    const result = calculateNetCashRatio(bs, 1000);
    // netCash = 100 + 50*0.7 - 800 = 100 + 35 - 800 = -665
    // ratio = -665 / 1000 = -0.665
    expect(result).toBeCloseTo(-0.665, 3);
  });
});
