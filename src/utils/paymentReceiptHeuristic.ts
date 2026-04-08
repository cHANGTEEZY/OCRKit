import type { ResponseProfile } from "../schemas/document.enums.js";

const MONTH: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  sept: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

const ITEM_SKIP =
  /^(subtotal|tax|tip|change|discount|vat|gst|hst|amount\s*due|balance|service|gratuity|total)\b/i;

/** "Name $12" / "Name $1,234.56" at end of line */
const LINE_PRICE = /^(.+?)\s+\$(\d[\d,]*(?:\.\d{1,2})?)\s*$/i;

/** Line that is only "total" (not subtotal) with money */
const LINE_TOTAL = /^\s*total\s*[:.]?\s*\$?\s*([\d,]+\.?\d*)\s*$/i;

const PHONEISH = /^[\+]?[(]?[\d\s().-]{8,}[\d)]?$/;

function parseMoney(s: string): number | null {
  const n = Number.parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function guessTitle(lines: string[]): string | null {
  for (const line of lines) {
    if (!line || line.includes("$")) continue;
    if (PHONEISH.test(line.replace(/\s/g, ""))) continue;
    if (/^[\d\s.,#\-–—'’]+$/.test(line) && /\d{3,}/.test(line)) continue;
    if (/invoice#|transaction#/i.test(line)) continue;
    if (/^\d{1,2}[-/\s.]+\w+[-/\s.]+\d{2,4}/i.test(line)) continue;
    if (/[A-Za-z]{2,}/.test(line)) return line;
  }
  return null;
}

function parseItems(lines: string[]): Array<{ itemName: string | null; price: number | null }> {
  const items: Array<{ itemName: string | null; price: number | null }> = [];
  for (const line of lines) {
    const m = line.match(LINE_PRICE);
    if (!m?.[1] || m[2] === undefined) continue;
    const name = m[1].trim();
    if (ITEM_SKIP.test(name)) continue;
    if (LINE_TOTAL.test(line)) continue;
    const price = parseMoney(m[2]);
    items.push({ itemName: name || null, price });
  }
  return items;
}

function parseTotal(lines: string[]): number | null {
  for (const line of lines) {
    const m = line.match(LINE_TOTAL);
    if (m?.[1]) return parseMoney(m[1]);
  }
  const m = lines.join("\n").match(/^\s*total\s*[:.]?\s*\$?\s*([\d,]+\.?\d*)\s*$/im);
  if (m?.[1]) return parseMoney(m[1]);
  return null;
}

function parseReceiptDate(raw: string): string | null {
  const m = raw.match(
    /(\d{1,2})[-\s./]+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[-\s./]+(\d{2,4})/i,
  );
  if (m?.[1] && m[2] && m[3]) {
    const d = m[1].padStart(2, "0");
    const mon = MONTH[m[2].toLowerCase()];
    if (!mon) return null;
    let y = m[3];
    if (y.length === 2) y = parseInt(y, 10) > 50 ? `19${y}` : `20${y}`;
    return `${y}-${mon}-${d}`;
  }
  const iso = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso?.[1] && iso[2] && iso[3])
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function parseTransactionId(lines: string[], raw: string): string | null {
  const afterHeader = raw.match(/invoice#\s*transaction#([\s\S]{0,80})/i);
  const afterChunk = afterHeader?.[1];
  if (afterChunk) {
    const chunk = afterChunk.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of chunk) {
      const two = line.match(/^(\d+)\s+(\d{6,})$/);
      if (two?.[2]) return two[2];
    }
  }
  const m = raw.match(/(?:transaction#|transaction\s*no\.?)\s*[:\s]*(\d{6,})/i);
  if (m?.[1]) return m[1];
  for (let i = 0; i < lines.length; i++) {
    if (/invoice#|transaction#/i.test(lines[i] ?? "")) {
      const next = lines[i + 1];
      if (next) {
        const two = next.match(/^(\d+)\s+(\d{6,})$/);
        if (two?.[2]) return two[2];
      }
    }
  }
  return null;
}

function pickKeys(
  data: Record<string, unknown>,
  allowed: Set<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      out[key] = data[key];
    }
  }
  return out;
}

/**
 * Best-effort parsing for common English receipts when FORMATTER_MODE=stub.
 * Does not replace an LLM for messy layouts.
 */
export function heuristicPaymentReceiptFromText(
  rawText: string,
  responseProfile: ResponseProfile,
  allowedKeys: readonly string[],
): Record<string, unknown> {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const allowed = new Set(allowedKeys);

  const data: Record<string, unknown> = {
    title: guessTitle(lines),
    items: parseItems(lines),
  };

  if (responseProfile === "full") {
    if (rawText.includes("$")) data.currency = "USD";
    data.totalAmount = parseTotal(lines);
    data.receiptDate = parseReceiptDate(rawText);
    data.transactionId = parseTransactionId(lines, rawText);
  }

  return pickKeys(data, allowed);
}
