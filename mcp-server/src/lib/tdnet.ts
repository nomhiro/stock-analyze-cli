/**
 * TDnet（やのしん API）クライアント
 * 適時開示情報の取得
 */

import type { DisclosureEvent } from "../types/stock.js";

const BASE_URL = "https://webapi.yanoshin.jp/webapi/tdnet/list";

// === TDnet API 固有型 ===

interface TdnetItem {
  Tdnet: {
    id: string;
    pubdate: string;
    company_code: string;
    company_name: string;
    title: string;
    document_url: string;
    markets_string: string | null;
  };
}

interface TdnetResponse {
  total_count: number;
  items: TdnetItem[];
}

// === ヘルパー ===

function classifyDocumentType(
  title: string,
): DisclosureEvent["documentType"] {
  if (/決算短信|四半期報告|有価証券報告/.test(title)) return "earnings";
  if (/業績予想.*修正|配当予想.*修正|上方修正|下方修正/.test(title))
    return "revision";
  if (/受注/.test(title)) return "order";
  return "other";
}

function companyCodeToSymbol(code: string): string {
  // やのしん API は 5 桁（例: "48750"）で返すが、東証コードは 4 桁 + ".T"
  const fourDigit = code.length === 5 ? code.slice(0, 4) : code;
  return `${fourDigit}.T`;
}

function mapToDisclosureEvent(item: TdnetItem): DisclosureEvent {
  const tdnet = item.Tdnet;
  return {
    type: "disclosure",
    id: tdnet.id,
    symbol: companyCodeToSymbol(tdnet.company_code),
    companyName: tdnet.company_name,
    title: tdnet.title,
    documentType: classifyDocumentType(tdnet.title),
    publishedAt: new Date(tdnet.pubdate).toISOString(),
    documentUrl: tdnet.document_url,
    analyzed: false,
  };
}

// === 公開関数 ===

/** 日付指定で適時開示一覧を取得 */
export async function getDisclosuresByDate(
  date: string, // YYYYMMDD
  limit = 100,
): Promise<DisclosureEvent[]> {
  const url = `${BASE_URL}/${date}.json?limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TDnet API error: ${res.status}`);
  }
  const data: TdnetResponse = await res.json();
  return data.items.map(mapToDisclosureEvent);
}

/** 銘柄コード指定で適時開示一覧を取得 */
export async function getDisclosuresBySymbol(
  symbol: string, // e.g. "7203.T"
  limit = 50,
): Promise<DisclosureEvent[]> {
  const code = symbol.replace(".T", "");
  const url = `${BASE_URL}/${code}.json?limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TDnet API error: ${res.status}`);
  }
  const data: TdnetResponse = await res.json();
  return data.items.map(mapToDisclosureEvent);
}

/** 直近の適時開示を取得 */
export async function getRecentDisclosures(
  limit = 100,
): Promise<DisclosureEvent[]> {
  const url = `${BASE_URL}/recent.json?limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TDnet API error: ${res.status}`);
  }
  const data: TdnetResponse = await res.json();
  return data.items.map(mapToDisclosureEvent);
}
