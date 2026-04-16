import { describe, it, expect } from "vitest";
import { formatJPY, formatLargeNumber, formatPercent, formatVolume, formatDate } from "./formatters.js";

describe("formatJPY", () => {
  it("formats positive integer as JPY currency", () => {
    expect(formatJPY(1500)).toBe("￥1,500");
  });

  it("formats zero", () => {
    expect(formatJPY(0)).toBe("￥0");
  });

  it("formats negative value", () => {
    expect(formatJPY(-300)).toBe("-￥300");
  });
});

describe("formatLargeNumber", () => {
  it("formats trillions as 兆", () => {
    expect(formatLargeNumber(1_500_000_000_000)).toBe("1.5兆");
  });

  it("formats billions as 億", () => {
    expect(formatLargeNumber(500_000_000)).toBe("5.0億");
  });

  it("formats ten-thousands as 万", () => {
    expect(formatLargeNumber(50_000)).toBe("5.0万");
  });

  it("formats small numbers with locale string", () => {
    expect(formatLargeNumber(9999)).toBe("9,999");
  });

  it("formats exactly 1兆", () => {
    expect(formatLargeNumber(1_000_000_000_000)).toBe("1.0兆");
  });
});

describe("formatPercent", () => {
  it("formats positive with + sign", () => {
    expect(formatPercent(3.5)).toBe("+3.50%");
  });

  it("formats negative with - sign", () => {
    expect(formatPercent(-2.1)).toBe("-2.10%");
  });

  it("formats zero with + sign", () => {
    expect(formatPercent(0)).toBe("+0.00%");
  });
});

describe("formatVolume", () => {
  it("formats volume with locale separators", () => {
    expect(formatVolume(1234567)).toBe("1,234,567");
  });
});

describe("formatDate", () => {
  it("formats ISO date string to Japanese format", () => {
    const result = formatDate("2024-03-15");
    expect(result).toMatch(/2024/);
    expect(result).toMatch(/03/);
    expect(result).toMatch(/15/);
  });
});
