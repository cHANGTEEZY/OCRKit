/**
 * Extract a single JSON value from model output that may include markdown fences or prose.
 */
export function extractJsonObjectString(raw: string): string {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(trimmed);
  if (fence?.[1]) {
    return fence[1].trim();
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return trimmed;
}

export function parseJsonObject(raw: string): Record<string, unknown> {
  const slice = extractJsonObjectString(raw);
  const parsed: unknown = JSON.parse(slice);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new SyntaxError("JSON root must be an object");
  }
  return parsed as Record<string, unknown>;
}
