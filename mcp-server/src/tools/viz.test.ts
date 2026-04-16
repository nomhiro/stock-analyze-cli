import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerVizTools, generateFromTemplate } from "./viz.js";

// Mock node:fs/promises
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

import { readFile, writeFile, mkdir } from "node:fs/promises";

const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);
const mockMkdir = vi.mocked(mkdir);

describe("generateFromTemplate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TEMPLATE_DIR = "./templates";
    process.env.OUTPUT_DIR = "./output";
  });

  it("replaces all placeholders and writes output file", async () => {
    const baseCss = "body { background: #1a1a2e; }";
    const template = "<!DOCTYPE html><style>{{BASE_CSS}}</style><h1>{{TITLE}}</h1><script>const d={{DATA}};</script>";

    mockReadFile
      .mockResolvedValueOnce(baseCss as never) // base.css
      .mockResolvedValueOnce(template as never); // template file
    mockMkdir.mockResolvedValueOnce(undefined);
    mockWriteFile.mockResolvedValueOnce(undefined);

    const result = await generateFromTemplate(
      "test.html",
      { TITLE: "テスト", DATA: '[{"x":1}]' },
      "out.html",
    );

    expect(result).toContain("output");
    expect(result).toContain("out.html");

    // Verify base CSS was injected
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const writtenContent = (mockWriteFile.mock.calls[0] as unknown[])[1] as string;
    expect(writtenContent).toContain("body { background: #1a1a2e; }");
    expect(writtenContent).toContain("テスト");
    expect(writtenContent).toContain('[{"x":1}]');
    expect(writtenContent).not.toContain("{{BASE_CSS}}");
    expect(writtenContent).not.toContain("{{TITLE}}");
    expect(writtenContent).not.toContain("{{DATA}}");

    // Verify mkdir was called
    expect(mockMkdir).toHaveBeenCalledWith("./output", { recursive: true });
  });

  it("replaces multiple occurrences of same placeholder", async () => {
    const baseCss = "";
    const template = "{{TITLE}} - {{TITLE}}";

    mockReadFile
      .mockResolvedValueOnce(baseCss as never)
      .mockResolvedValueOnce(template as never);
    mockMkdir.mockResolvedValueOnce(undefined);
    mockWriteFile.mockResolvedValueOnce(undefined);

    await generateFromTemplate("test.html", { TITLE: "ABC" }, "out.html");

    const writtenContent = (mockWriteFile.mock.calls[0] as unknown[])[1] as string;
    expect(writtenContent).toBe("ABC - ABC");
  });
});

describe("registerVizTools", () => {
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
    registerVizTools(mockServer as never);
  });

  it("registers all 5 viz tools", () => {
    expect(mockServer.tool).toHaveBeenCalledTimes(5);
    expect(registeredTools.has("viz_candlestick")).toBe(true);
    expect(registeredTools.has("viz_pie_chart")).toBe(true);
    expect(registeredTools.has("viz_heatmap")).toBe(true);
    expect(registeredTools.has("viz_network_graph")).toBe(true);
    expect(registeredTools.has("viz_ranking_table")).toBe(true);
  });

  it("viz_candlestick generates HTML file", async () => {
    mockReadFile
      .mockResolvedValueOnce("body{}" as never)
      .mockResolvedValueOnce("<style>{{BASE_CSS}}</style>{{TITLE}}{{DATA}}" as never);
    mockMkdir.mockResolvedValueOnce(undefined);
    mockWriteFile.mockResolvedValueOnce(undefined);

    const handler = registeredTools.get("viz_candlestick")!.handler;
    const result = await handler({
      title: "トヨタ",
      data: [{ time: "2026-01-01", open: 100, high: 110, low: 90, close: 105 }],
      outputName: "test.html",
    });
    const parsed = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

    expect(parsed.success).toBe(true);
    expect(parsed.outputPath).toContain("test.html");
  });

  it("viz_pie_chart generates HTML file", async () => {
    mockReadFile
      .mockResolvedValueOnce("body{}" as never)
      .mockResolvedValueOnce("<style>{{BASE_CSS}}</style>{{TITLE}}{{DATA}}" as never);
    mockMkdir.mockResolvedValueOnce(undefined);
    mockWriteFile.mockResolvedValueOnce(undefined);

    const handler = registeredTools.get("viz_pie_chart")!.handler;
    const result = await handler({
      title: "セクター構成",
      data: [{ label: "情報技術", value: 40 }, { label: "金融", value: 30 }],
      outputName: "pie.html",
    });
    const parsed = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

    expect(parsed.success).toBe(true);
  });

  it("viz_heatmap generates HTML file", async () => {
    mockReadFile
      .mockResolvedValueOnce("body{}" as never)
      .mockResolvedValueOnce("<style>{{BASE_CSS}}</style>{{TITLE}}{{DATA}}" as never);
    mockMkdir.mockResolvedValueOnce(undefined);
    mockWriteFile.mockResolvedValueOnce(undefined);

    const handler = registeredTools.get("viz_heatmap")!.handler;
    const result = await handler({
      title: "ヒートマップ",
      data: {
        columns: 3,
        cells: [{ label: "A", value: 10 }, { label: "B", value: -5 }],
      },
      outputName: "heatmap.html",
    });
    const parsed = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

    expect(parsed.success).toBe(true);
  });

  it("viz_network_graph generates HTML file", async () => {
    mockReadFile
      .mockResolvedValueOnce("body{}" as never)
      .mockResolvedValueOnce("<style>{{BASE_CSS}}</style>{{TITLE}}{{DATA}}" as never);
    mockMkdir.mockResolvedValueOnce(undefined);
    mockWriteFile.mockResolvedValueOnce(undefined);

    const handler = registeredTools.get("viz_network_graph")!.handler;
    const result = await handler({
      title: "関連銘柄",
      data: {
        nodes: [{ id: 1, label: "トヨタ" }, { id: 2, label: "ホンダ" }],
        edges: [{ from: 1, to: 2, label: "同業種" }],
      },
      outputName: "network.html",
    });
    const parsed = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

    expect(parsed.success).toBe(true);
  });

  it("viz_ranking_table generates HTML file", async () => {
    mockReadFile
      .mockResolvedValueOnce("body{}" as never)
      .mockResolvedValueOnce("<style>{{BASE_CSS}}</style>{{TITLE}}{{DATA}}" as never);
    mockMkdir.mockResolvedValueOnce(undefined);
    mockWriteFile.mockResolvedValueOnce(undefined);

    const handler = registeredTools.get("viz_ranking_table")!.handler;
    const result = await handler({
      title: "バリュー株ランキング",
      data: {
        columns: [
          { key: "symbol", label: "銘柄", align: "left" },
          { key: "per", label: "PER", colorize: false },
        ],
        rows: [
          { symbol: "7203.T", per: 8.5 },
          { symbol: "6758.T", per: 12.3 },
        ],
      },
      outputName: "ranking.html",
    });
    const parsed = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

    expect(parsed.success).toBe(true);
  });
});
