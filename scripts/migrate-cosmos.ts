#!/usr/bin/env node
/**
 * Cosmos DB → local JSON migration script.
 *
 * One-time migration from the stock-analyze-ai web app (Azure Cosmos DB)
 * into the stock-analyze-cli `data/` directory.
 *
 * Usage:
 *   COSMOS_DB_ENDPOINT=https://xxx.documents.azure.com:443/ \
 *   COSMOS_DB_KEY=xxxxx \
 *   MIGRATE_USER_ID=your-email@example.com \
 *   npx tsx scripts/migrate-cosmos.ts
 */
import { CosmosClient, type Database } from "@azure/cosmos";
import { writeJsonFile } from "../mcp-server/src/lib/json-store.js";
import type {
  JudgmentFile,
  JudgmentEntry,
  JudgmentVerdict,
  UserSettings,
} from "../mcp-server/src/types/analysis.js";
import type { PortfolioData } from "../mcp-server/src/types/portfolio.js";

const DATABASE_NAME = "stock-analyzer";

function getRequiredEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

async function main(): Promise<void> {
  const endpoint = getRequiredEnv("COSMOS_DB_ENDPOINT");
  const key = getRequiredEnv("COSMOS_DB_KEY");
  const userId = getRequiredEnv("MIGRATE_USER_ID");

  const client = new CosmosClient({ endpoint, key });
  const database = client.database(DATABASE_NAME);

  console.log(`Starting migration from "${DATABASE_NAME}" for user: ${userId}`);

  await migrateJudgments(database);
  await migratePortfolio(database, userId);
  await migrateWatchlist(database, userId);
  await migrateAnomalySettings(database);
  await migrateSectors(database);
  await migrateScreening(database);

  console.log("Migration complete.");
}

function mapVerdict(raw: unknown): JudgmentVerdict {
  const valid: readonly JudgmentVerdict[] = [
    "買い検討",
    "注目",
    "様子見",
    "見送り",
  ];
  if (typeof raw === "string" && (valid as readonly string[]).includes(raw)) {
    return raw as JudgmentVerdict;
  }
  return "様子見";
}

interface JudgmentDoc {
  id: string;
  judgment?: string;
  totalScore?: number;
  valuationScore?: number;
  changeContinuityScore?: number;
  growthOutlookScore?: number;
  summary?: string;
  rawResult?: string;
  analyzedAt?: string;
}

async function migrateJudgments(db: Database): Promise<void> {
  const container = db.container("judgments");
  const { resources } = await container.items
    .readAll<JudgmentDoc>()
    .fetchAll();
  console.log(`Found ${resources.length} judgments`);

  for (const doc of resources) {
    const symbol = doc.id;
    const entry: JudgmentEntry = {
      date: doc.analyzedAt ? doc.analyzedAt.split("T")[0] : "",
      verdict: mapVerdict(doc.judgment),
      scores: {
        value: doc.valuationScore ?? 0,
        momentum: doc.changeContinuityScore ?? 0,
        growth: doc.growthOutlookScore ?? 0,
        total: doc.totalScore ?? 0,
      },
      summary: doc.summary ?? "",
      analysis: doc.rawResult ?? "",
    };
    const file: JudgmentFile = { symbol, history: [entry] };
    await writeJsonFile(`judgments/${symbol}.json`, file);
  }
}

interface PortfolioDoc {
  id: string;
  userId: string;
  holdings?: PortfolioData["holdings"];
  updatedAt?: string;
}

async function migratePortfolio(db: Database, userId: string): Promise<void> {
  const container = db.container("portfolios");
  const { resources } = await container.items
    .query<PortfolioDoc>({
      query: "SELECT * FROM c WHERE c.userId = @userId",
      parameters: [{ name: "@userId", value: userId }],
    })
    .fetchAll();

  if (resources.length === 0) {
    console.log("No portfolio found for user");
    return;
  }

  const doc = resources[0];
  const data: PortfolioData = {
    holdings: doc.holdings ?? [],
    updatedAt: doc.updatedAt ?? new Date().toISOString(),
  };
  await writeJsonFile("portfolio.json", data);
  console.log(`Portfolio: ${data.holdings.length} holdings`);
}

interface WatchlistDoc {
  id: string;
  symbols?: string[];
}

async function migrateWatchlist(db: Database, userId: string): Promise<void> {
  const container = db.container("settings");
  const docId = `watchlist:${userId}`;
  try {
    const { resource } = await container
      .item(docId, docId)
      .read<WatchlistDoc>();
    const symbols = resource?.symbols ?? [];
    await writeJsonFile("watchlist.json", symbols);
    console.log(`Watchlist: ${symbols.length} symbols`);
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 404) {
      console.log("No watchlist found");
      return;
    }
    throw err;
  }
}

interface AnomalySettingsDoc {
  id: string;
  dividendYieldThreshold?: number;
  perThreshold?: number;
  pbrThreshold?: number;
}

async function migrateAnomalySettings(db: Database): Promise<void> {
  const container = db.container("settings");
  try {
    const { resource } = await container
      .item("anomaly-settings", "anomaly-settings")
      .read<AnomalySettingsDoc>();
    const settings: UserSettings = {
      anomaly: {
        dividendYieldThreshold: resource?.dividendYieldThreshold ?? 5.0,
        perThreshold: resource?.perThreshold ?? 50,
        pbrThreshold: resource?.pbrThreshold ?? 0.5,
      },
      updatedAt: new Date().toISOString(),
    };
    await writeJsonFile("settings.json", settings);
    console.log("Anomaly settings migrated");
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 404) {
      console.log("No anomaly settings found, using defaults");
      return;
    }
    throw err;
  }
}

interface SectorDoc {
  id: string;
  sectorCode?: string;
  sectorName?: string;
  analyzedAt?: string;
  positiveKeywords?: string[];
  negativeKeywords?: string[];
}

async function migrateSectors(db: Database): Promise<void> {
  const container = db.container("sectors");
  const { resources } = await container.items.readAll<SectorDoc>().fetchAll();
  if (resources.length === 0) {
    console.log("No sectors found");
    return;
  }
  await writeJsonFile("sectors/keywords.json", resources);
  console.log(`Sectors: ${resources.length} analyses`);
}

interface ScreeningDoc {
  id: string;
  createdAt?: string;
}

async function migrateScreening(db: Database): Promise<void> {
  const container = db.container("screening");
  const { resources } = await container.items
    .query<ScreeningDoc>({
      query: "SELECT TOP 1 * FROM c ORDER BY c.createdAt DESC",
    })
    .fetchAll();
  if (resources.length === 0) {
    console.log("No screening results found");
    return;
  }
  await writeJsonFile("screening/latest.json", resources[0]);
  console.log("Screening latest migrated");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
