import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerJudgmentTools } from "./judgment.js";

// Mock json-store
vi.mock("../lib/json-store.js", () => ({
  readJsonFile: vi.fn(),
  writeJsonFile: vi.fn(),
}));

// Mock node:fs/promises
vi.mock("node:fs/promises", () => ({
  readdir: vi.fn(),
}));

import { readJsonFile, writeJsonFile } from "../lib/json-store.js";
import { readdir } from "node:fs/promises";

const mockReadJsonFile = vi.mocked(readJsonFile);
const mockWriteJsonFile = vi.mocked(writeJsonFile);
const mockReaddir = vi.mocked(readdir);

describe("registerJudgmentTools", () => {
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
    registerJudgmentTools(mockServer as never);
  });

  it("registers all 3 judgment tools", () => {
    expect(mockServer.tool).toHaveBeenCalledTimes(3);
    expect(registeredTools.has("judgment_get")).toBe(true);
    expect(registeredTools.has("judgment_list")).toBe(true);
    expect(registeredTools.has("judgment_save")).toBe(true);
  });

  it("judgment_get returns judgment data for symbol", async () => {
    const judgmentData = {
      symbol: "7203.T",
      history: [
        {
          date: "2026-04-01",
          verdict: "注目",
          scores: { value: 7, momentum: 6, growth: 8, total: 21 },
          summary: "テスト",
          analysis: "詳細分析テスト",
        },
      ],
    };
    mockReadJsonFile.mockResolvedValueOnce(judgmentData);

    const handler = registeredTools.get("judgment_get")!.handler;
    const result = await handler({ symbol: "7203.T" });
    const parsed = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

    expect(parsed.symbol).toBe("7203.T");
    expect(parsed.history).toHaveLength(1);
    expect(parsed.history[0].verdict).toBe("注目");
    expect(mockReadJsonFile).toHaveBeenCalledWith(
      "judgments/7203.T.json",
      { symbol: "7203.T", history: [] },
    );
  });

  it("judgment_get returns default for unknown symbol", async () => {
    mockReadJsonFile.mockResolvedValueOnce({ symbol: "9999.T", history: [] });

    const handler = registeredTools.get("judgment_get")!.handler;
    const result = await handler({ symbol: "9999.T" });
    const parsed = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

    expect(parsed.symbol).toBe("9999.T");
    expect(parsed.history).toHaveLength(0);
  });

  it("judgment_save appends to history", async () => {
    const existing = {
      symbol: "7203.T",
      history: [
        {
          date: "2026-03-01",
          verdict: "様子見",
          scores: { value: 5, momentum: 4, growth: 3, total: 12 },
          summary: "旧サマリー",
          analysis: "旧分析",
        },
      ],
    };
    mockReadJsonFile.mockResolvedValueOnce(existing);
    mockWriteJsonFile.mockResolvedValueOnce(undefined);

    const handler = registeredTools.get("judgment_save")!.handler;
    const newResult = {
      date: "2026-04-01",
      verdict: "買い検討" as const,
      scores: { value: 8, momentum: 7, growth: 9, total: 24 },
      summary: "新サマリー",
      analysis: "新分析",
    };
    const result = await handler({ symbol: "7203.T", result: newResult });
    const parsed = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

    expect(parsed.success).toBe(true);
    expect(parsed.historyLength).toBe(2);

    expect(mockWriteJsonFile).toHaveBeenCalledWith(
      "judgments/7203.T.json",
      expect.objectContaining({
        symbol: "7203.T",
        history: expect.arrayContaining([
          expect.objectContaining({ date: "2026-03-01" }),
          expect.objectContaining({ date: "2026-04-01", verdict: "買い検討" }),
        ]),
      }),
    );
  });

  it("judgment_list reads directory and returns summaries", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockReaddir.mockResolvedValueOnce(["7203.T.json", "6758.T.json"] as any);
    mockReadJsonFile
      .mockResolvedValueOnce({
        symbol: "7203.T",
        history: [
          {
            date: "2026-04-01",
            verdict: "注目",
            scores: { value: 7, momentum: 6, growth: 8, total: 21 },
            summary: "テスト",
            analysis: "テスト",
          },
        ],
      })
      .mockResolvedValueOnce({
        symbol: "6758.T",
        history: [
          {
            date: "2026-04-02",
            verdict: "買い検討",
            scores: { value: 9, momentum: 8, growth: 7, total: 24 },
            summary: "テスト2",
            analysis: "テスト2",
          },
        ],
      });

    const handler = registeredTools.get("judgment_list")!.handler;
    const result = await handler({});
    const parsed = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({
      symbol: "7203.T",
      latestDate: "2026-04-01",
      verdict: "注目",
      totalScore: 21,
    });
    expect(parsed[1]).toEqual({
      symbol: "6758.T",
      latestDate: "2026-04-02",
      verdict: "買い検討",
      totalScore: 24,
    });
  });

  it("judgment_list returns empty array when directory does not exist", async () => {
    mockReaddir.mockRejectedValueOnce(new Error("ENOENT"));

    const handler = registeredTools.get("judgment_list")!.handler;
    const result = await handler({});
    const parsed = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

    expect(parsed).toEqual([]);
  });

  it("judgment_list ignores non-json files", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockReaddir.mockResolvedValueOnce(["7203.T.json", ".gitkeep", "readme.txt"] as any);
    mockReadJsonFile.mockResolvedValueOnce({
      symbol: "7203.T",
      history: [
        {
          date: "2026-04-01",
          verdict: "注目",
          scores: { value: 7, momentum: 6, growth: 8, total: 21 },
          summary: "テスト",
          analysis: "テスト",
        },
      ],
    });

    const handler = registeredTools.get("judgment_list")!.handler;
    const result = await handler({});
    const parsed = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].symbol).toBe("7203.T");
  });
});
