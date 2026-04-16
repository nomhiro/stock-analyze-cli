import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "node:fs/promises";
import * as path from "node:path";

function getTemplateDir(): string {
  return process.env.TEMPLATE_DIR || "./templates";
}

function getOutputDir(): string {
  return process.env.OUTPUT_DIR || "./output";
}

export async function generateFromTemplate(
  templateName: string,
  replacements: Record<string, string>,
  outputName: string,
): Promise<string> {
  const baseCss = await fs.readFile(
    path.join(getTemplateDir(), "shared/base.css"),
    "utf-8",
  );
  let template = await fs.readFile(
    path.join(getTemplateDir(), templateName),
    "utf-8",
  );
  template = template.replace("{{BASE_CSS}}", baseCss);
  for (const [key, value] of Object.entries(replacements)) {
    template = template.replaceAll(`{{${key}}}`, value);
  }
  const outputDir = getOutputDir();
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, outputName);
  await fs.writeFile(outputPath, template, "utf-8");
  return outputPath;
}

export function registerVizTools(server: McpServer): void {
  server.tool(
    "viz_candlestick",
    "ローソク足チャートのHTMLを生成する",
    {
      title: z.string().describe("チャートタイトル"),
      data: z
        .array(
          z.object({
            time: z.string().describe("日付（YYYY-MM-DD）"),
            open: z.number(),
            high: z.number(),
            low: z.number(),
            close: z.number(),
          }),
        )
        .describe("ローソク足データ"),
      outputName: z.string().optional().default("candlestick.html").describe("出力ファイル名"),
    },
    async ({ title, data, outputName }) => {
      const outputPath = await generateFromTemplate(
        "candlestick.html",
        { TITLE: title, DATA: JSON.stringify(data) },
        outputName,
      );
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ success: true, outputPath }) },
        ],
      };
    },
  );

  server.tool(
    "viz_pie_chart",
    "円グラフ（ドーナツチャート）のHTMLを生成する",
    {
      title: z.string().describe("チャートタイトル"),
      data: z
        .array(
          z.object({
            label: z.string().describe("ラベル"),
            value: z.number().describe("値"),
          }),
        )
        .describe("円グラフデータ"),
      outputName: z.string().optional().default("pie-chart.html").describe("出力ファイル名"),
    },
    async ({ title, data, outputName }) => {
      const outputPath = await generateFromTemplate(
        "pie-chart.html",
        { TITLE: title, DATA: JSON.stringify(data) },
        outputName,
      );
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ success: true, outputPath }) },
        ],
      };
    },
  );

  server.tool(
    "viz_heatmap",
    "ヒートマップのHTMLを生成する",
    {
      title: z.string().describe("チャートタイトル"),
      data: z
        .object({
          columns: z.number().optional().default(4).describe("列数"),
          cells: z
            .array(
              z.object({
                label: z.string().describe("セルラベル"),
                value: z.number().describe("セル値"),
              }),
            )
            .describe("セルデータ"),
        })
        .describe("ヒートマップデータ"),
      outputName: z.string().optional().default("heatmap.html").describe("出力ファイル名"),
    },
    async ({ title, data, outputName }) => {
      const outputPath = await generateFromTemplate(
        "heatmap.html",
        { TITLE: title, DATA: JSON.stringify(data) },
        outputName,
      );
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ success: true, outputPath }) },
        ],
      };
    },
  );

  server.tool(
    "viz_network_graph",
    "ネットワークグラフのHTMLを生成する",
    {
      title: z.string().describe("グラフタイトル"),
      data: z
        .object({
          nodes: z
            .array(
              z.object({
                id: z.union([z.string(), z.number()]).describe("ノードID"),
                label: z.string().describe("ノードラベル"),
                color: z.string().optional().describe("ノード色"),
                size: z.number().optional().describe("ノードサイズ"),
              }),
            )
            .describe("ノード一覧"),
          edges: z
            .array(
              z.object({
                from: z.union([z.string(), z.number()]).describe("始点ノードID"),
                to: z.union([z.string(), z.number()]).describe("終点ノードID"),
                label: z.string().optional().describe("エッジラベル"),
                width: z.number().optional().describe("エッジ幅"),
              }),
            )
            .describe("エッジ一覧"),
        })
        .describe("ネットワークグラフデータ"),
      outputName: z.string().optional().default("network-graph.html").describe("出力ファイル名"),
    },
    async ({ title, data, outputName }) => {
      const outputPath = await generateFromTemplate(
        "network-graph.html",
        { TITLE: title, DATA: JSON.stringify(data) },
        outputName,
      );
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ success: true, outputPath }) },
        ],
      };
    },
  );

  server.tool(
    "viz_ranking_table",
    "ソート可能なランキングテーブルのHTMLを生成する",
    {
      title: z.string().describe("テーブルタイトル"),
      data: z
        .object({
          columns: z
            .array(
              z.object({
                key: z.string().describe("データキー"),
                label: z.string().describe("列ヘッダー"),
                align: z.string().optional().describe("テキスト配置（left/center/right）"),
                colorize: z.boolean().optional().describe("正負で色分けするか"),
              }),
            )
            .describe("列定義"),
          rows: z.array(z.record(z.unknown())).describe("行データ"),
        })
        .describe("テーブルデータ"),
      outputName: z.string().optional().default("ranking-table.html").describe("出力ファイル名"),
    },
    async ({ title, data, outputName }) => {
      const outputPath = await generateFromTemplate(
        "ranking-table.html",
        { TITLE: title, DATA: JSON.stringify(data) },
        outputName,
      );
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ success: true, outputPath }) },
        ],
      };
    },
  );
}
