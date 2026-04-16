import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { readJsonFile, writeJsonFile } from "../lib/json-store.js";
import type { JudgmentFile, JudgmentEntry } from "../types/analysis.js";

function getDataDir(): string {
  return process.env.DATA_DIR || "./data";
}

export function registerJudgmentTools(server: McpServer): void {
  server.tool(
    "judgment_get",
    "銘柄のAI判定履歴を取得する",
    {
      symbol: z.string().describe("銘柄コード（例: 7203.T）"),
    },
    async ({ symbol }) => {
      const data = await readJsonFile<JudgmentFile>(
        `judgments/${symbol}.json`,
        { symbol, history: [] },
      );
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  server.tool(
    "judgment_list",
    "保存済みの全銘柄判定一覧を取得する",
    {},
    async () => {
      const dirPath = path.join(getDataDir(), "judgments");
      let files: string[];
      try {
        files = await fs.readdir(dirPath);
      } catch {
        // Directory doesn't exist yet
        return {
          content: [{ type: "text" as const, text: JSON.stringify([]) }],
        };
      }

      const jsonFiles = files.filter((f) => f.endsWith(".json"));
      const results: Array<{
        symbol: string;
        latestDate: string;
        verdict: string;
        totalScore: number;
      }> = [];

      for (const file of jsonFiles) {
        const symbol = file.replace(".json", "");
        const data = await readJsonFile<JudgmentFile>(
          `judgments/${file}`,
          { symbol, history: [] },
        );
        if (data.history.length > 0) {
          const latest = data.history[data.history.length - 1];
          results.push({
            symbol: data.symbol,
            latestDate: latest.date,
            verdict: latest.verdict,
            totalScore: latest.scores.total,
          });
        }
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
      };
    },
  );

  server.tool(
    "judgment_save",
    "銘柄のAI判定結果を保存する",
    {
      symbol: z.string().describe("銘柄コード"),
      result: z.object({
        date: z.string().describe("判定日（YYYY-MM-DD）"),
        verdict: z.enum(["買い検討", "注目", "様子見", "見送り"]).describe("判定結果"),
        scores: z.object({
          value: z.number().describe("バリュースコア"),
          momentum: z.number().describe("モメンタムスコア"),
          growth: z.number().describe("成長スコア"),
          total: z.number().describe("総合スコア"),
        }),
        summary: z.string().describe("サマリー"),
        analysis: z.string().describe("詳細分析"),
      }).describe("判定結果オブジェクト"),
    },
    async ({ symbol, result }) => {
      const data = await readJsonFile<JudgmentFile>(
        `judgments/${symbol}.json`,
        { symbol, history: [] },
      );

      const entry: JudgmentEntry = {
        date: result.date,
        verdict: result.verdict,
        scores: result.scores,
        summary: result.summary,
        analysis: result.analysis,
      };

      data.history.push(entry);
      await writeJsonFile(`judgments/${symbol}.json`, data);

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: true, symbol, historyLength: data.history.length }, null, 2) }],
      };
    },
  );
}
