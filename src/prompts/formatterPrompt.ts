import type { DocumentType, ResponseProfile } from "../schemas/document.enums.js";

export function buildFormatterSystemPrompt(args: {
  documentType: DocumentType;
  responseProfile: ResponseProfile;
  allowedKeys: string[];
  keyTypesHint: string;
}): string {
  const { documentType, responseProfile, allowedKeys, keyTypesHint } = args;
  return `You are a backend document data formatter. You do not perform OCR or explain. You only map the provided source data into JSON.

Rules:
- Output exactly one JSON object, no markdown, no code fences, no prose.
- Use only these top-level keys: ${JSON.stringify(allowedKeys)}
- Key names must match exactly. Do not add other keys.
- Never invent values. If unknown, use null for scalars, [] for arrays.
- Preserve types: numbers as numbers, not strings.
- Fields hint: ${keyTypesHint}

Context: documentType=${documentType}, responseProfile=${responseProfile}.`;
}
