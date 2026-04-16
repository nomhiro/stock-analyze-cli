import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerDataTools } from "./data.js";

// Mock json-store
vi.mock("../lib/json-store.js", () => ({
  readJsonFile: vi.fn(),
  writeJsonFile: vi.fn(),
}));

import { readJsonFile, writeJsonFile } from "../lib/json-store.js";

const mockReadJsonFile = vi.mocked(readJsonFile);
const mockWriteJsonFile = vi.mocked(writeJsonFile);

describe("registerDataTools", () => {
  // Collect tool registrations
  const registeredTools: Map<string, { description: string; schema: unknown; handler: Function }> = new Map();

  const mockServer = {
    tool: vi.fn(
      (name: string, description: string, schema: unknown, handler: Function) => {
        registeredTools.set(name, { description, schema, handler });
      },
    ),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    registeredTools.clear();
    registerDataTools(mockServer as never);
  });

  it("registers all 4 data tools", () => {
    expect(mockServer.tool).toHaveBeenCalledTimes(4);
    expect(registeredTools.has("data_tse_lookup")).toBe(true);
    expect(registeredTools.has("data_major_stocks")).toBe(true);
    expect(registeredTools.has("data_settings_get")).toBe(true);
    expect(registeredTools.has("data_settings_update")).toBe(true);
  });

  it("data_tse_lookup returns correct name for 7203.T", async () => {
    mockReadJsonFile.mockResolvedValueOnce({
      "7203.T": "トヨタ自動車",
      "6758.T": "ソニーグループ",
    });

    const handler = registeredTools.get("data_tse_lookup")!.handler;
    const result = await handler({ symbol: "7203.T" });

    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify({ symbol: "7203.T", name: "トヨタ自動車" }) }],
    });
    expect(mockReadJsonFile).toHaveBeenCalledWith("static/tse-names.json", {});
  });

  it("data_tse_lookup returns null for unknown symbol", async () => {
    mockReadJsonFile.mockResolvedValueOnce({
      "7203.T": "トヨタ自動車",
    });

    const handler = registeredTools.get("data_tse_lookup")!.handler;
    const result = await handler({ symbol: "9999.T" });

    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify({ symbol: "9999.T", name: null }) }],
    });
  });

  it("data_major_stocks returns the stock array", async () => {
    const stocks = ["7203.T", "6758.T", "9984.T"];
    mockReadJsonFile.mockResolvedValueOnce(stocks);

    const handler = registeredTools.get("data_major_stocks")!.handler;
    const result = await handler({});

    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify(stocks) }],
    });
    expect(mockReadJsonFile).toHaveBeenCalledWith("static/major-stocks.json", []);
  });

  it("data_settings_get returns settings", async () => {
    const settings = {
      anomaly: { dividendYieldThreshold: 5.0, perThreshold: 50, pbrThreshold: 0.5 },
      updatedAt: "",
    };
    mockReadJsonFile.mockResolvedValueOnce(settings);

    const handler = registeredTools.get("data_settings_get")!.handler;
    const result = await handler({});

    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify(settings) }],
    });
  });

  it("data_settings_update writes updated settings", async () => {
    const existingSettings = {
      anomaly: { dividendYieldThreshold: 5.0, perThreshold: 50, pbrThreshold: 0.5 },
      updatedAt: "",
    };
    mockReadJsonFile.mockResolvedValueOnce(existingSettings);
    mockWriteJsonFile.mockResolvedValueOnce(undefined);

    const handler = registeredTools.get("data_settings_update")!.handler;
    const result = await handler({ key: "anomaly.dividendYieldThreshold", value: 3.0 });

    const parsed = JSON.parse(
      (result as { content: Array<{ text: string }> }).content[0].text,
    );
    expect(parsed.success).toBe(true);
    expect(parsed.settings.anomaly.dividendYieldThreshold).toBe(3.0);
    expect(parsed.settings.updatedAt).toBeTruthy();

    expect(mockWriteJsonFile).toHaveBeenCalledWith(
      "settings.json",
      expect.objectContaining({
        anomaly: expect.objectContaining({ dividendYieldThreshold: 3.0 }),
      }),
    );
  });
});
