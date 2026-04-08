# ocrkit

A small **TypeScript** backend built with **Express** that runs **OCR on images** and can optionally turn raw text into **structured JSON** for known document types.

## Stack

- **Node.js** (ES modules) + **TypeScript**
- **Express 5** — HTTP API, JSON and multipart uploads
- **Tesseract.js** — on-device OCR (`eng`); returns extracted text and confidence
- **Zod** — request options and structured output validation
- **Optional OpenAI** — when enabled, an LLM infers structured fields from OCR text; otherwise a **stub** formatter fills the schema with safe defaults

Security and ops middleware include **Helmet**, **CORS**, **Morgan**, and **rate limiting**. Requests must include the internal API key (see below).

## What it does today

1. **Accepts an image** as either:
   - `multipart/form-data` with field name `image` (max **40MB**), or  
   - JSON body `{ "image": "<URL or data URL>" }` (same field name convention when combined with other JSON fields).

2. **Runs OCR** and returns `text` and optional `confidence`.

3. **Optional formatting** — If you ask for structured output, the service maps OCR text into a **typed object** plus **meta** (`missingFields`, `warnings`, `needsReview`, etc.).  
   - **Currently implemented in the document registry:** **`payment_receipt`** only, in two shapes:
     - **`summary`** — `merchantName`, `totalAmount`, `receiptDate`, `currency` (required for strict review: `merchantName`, `totalAmount`, `receiptDate`).
     - **`full`** — same fields plus `transactionId` and `lineItems` (array of `description` + `amount`); required keys include **`transactionId`** in addition to the summary required fields.
   - The API allows `documentType` values `payment_receipt | invoice | resume`, but **`invoice` and `resume` are not registered yet** — formatting those will return an unsupported variant error until schemas are added.

4. **Low confidence** — If OCR confidence is below **0.5** and you did **not** request formatting, the API responds with an error. If you **did** request formatting, processing continues and warnings/meta may reflect the weak OCR signal.

## Configuration

Create a `.env` (see your local template) with at least:

| Variable | Purpose |
|----------|---------|
| `INTERNAL_KEY` | Required. Clients must send `x-internal-key: <value>` |
| `PORT` | Server port (default `5000`) |
| `NODE_ENV` | `development` adds extra error detail on failures |
| `FORMATTER_MODE` | `stub` (default) or `openai` |
| `OPENAI_API_KEY` | Required when `FORMATTER_MODE=openai` |
| `OPENAI_MODEL` | Optional (default `gpt-4o-mini`) |

## Run locally

```bash
npm install
npm run dev
```

- Dev: `tsx watch src/server.ts`  
- Build: `npm run build` → `node dist/server.js`

## API

Base path: **`/api/v1`**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health-check` | Liveness |
| `POST` | `/ocr/parse` | OCR (+ optional structured format) |

**Auth:** every request must include header **`x-internal-key`** matching `INTERNAL_KEY`.

### `POST /ocr/parse`

**Formatting-related body fields** (JSON fields work with multipart too — use fields for `format`, `documentType`, etc., alongside file upload):

- `format` — boolean (or string `"true"` / `"1"`) to enable formatting  
- `documentType` — e.g. `payment_receipt` (required when formatting is requested)  
- `responseProfile` — `summary` or `full` (default `full`)  
- `strictMode` — boolean; when true, meta flags `needsReview` if required fields are missing  
- `clientRequestedFields` — optional subset of allowed keys (string array, comma-separated string, or JSON array string)

**Response shape (success):** `status`, `message`, and `data` containing OCR `text`, optional `confidence`, and optional `formatted: { data, meta }` when formatting ran.

## Project layout (high level)

- `src/server.ts` — Express app wiring  
- `src/routes/` — `/health-check`, `/ocr`  
- `src/controllers/ocr.controller.ts` — parse request → OCR → optional format  
- `src/services/ocr.service.ts` — Tesseract  
- `src/services/formatter.service.ts` — stub vs OpenAI, Zod validation, meta  
- `src/schemas/` — document types, **payment receipt** schemas, registry  

---

**Summary:** ocrkit is a TypeScript Express service for **image → text (OCR)** and, for **payment receipts**, **summary vs full structured JSON** with validation and review metadata. Enable **OpenAI** for real field inference from OCR text; **stub** mode is for wiring and tests without an LLM.
