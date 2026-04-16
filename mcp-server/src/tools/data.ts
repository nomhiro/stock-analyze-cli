import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readJsonFile, writeJsonFile } from "../lib/json-store.js";
import type { UserSettings } from "../types/analysis.js";

export function registerDataTools(server: McpServer): void {
  server.tool(
    "data_tse_lookup",
    "東証銘柄コードから日本語名を検索する",
    { symbol: z.string().describe("銘柄コード（例: 7203.T）") },
    async ({ symbol }) => {
      const names = await readJsonFile<Record<string, string>>("static/tse-names.json", {});
      const name = names[symbol] || names[symbol.replace(".T", "")] || null;
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ symbol, name }) }],
      };
    },
  );

  server.tool(
    "data_major_stocks",
    "メジャー銘柄リストを取得する",
    {},
    async () => {
      const stocks = await readJsonFile<string[]>("static/major-stocks.json", []);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(stocks) }],
      };
    },
  );

  server.tool(
    "data_settings_get",
    "ユーザー設定を取得する",
    {},
    async () => {
      const settings = await readJsonFile<UserSettings>("settings.json", {
        anomaly: { dividendYieldThreshold: 5.0, perThreshold: 50, pbrThreshold: 0.5 },
        updatedAt: "",
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(settings) }],
      };
    },
  );

  server.tool(
    "data_settings_update",
    "ユーザー設定を更新する",
    {
      key: z.enum(["anomaly.dividendYieldThreshold", "anomaly.perThreshold", "anomaly.pbrThreshold"]).describe("設定キー"),
      value: z.number().describe("設定値"),
    },
    async ({ key, value }) => {
      const settings = await readJsonFile<UserSettings>("settings.json", {
        anomaly: { dividendYieldThreshold: 5.0, perThreshold: 50, pbrThreshold: 0.5 },
        updatedAt: "",
      });
      const [section, field] = key.split(".") as ["anomaly", string];
      (settings[section] as Record<string, number>)[field] = value;
      settings.updatedAt = new Date().toISOString();
      await writeJsonFile("settings.json", settings);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: true, settings }) }],
      };
    },
  );
}
