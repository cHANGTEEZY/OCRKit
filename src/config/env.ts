import dotenv from "dotenv";

dotenv.config();

const formatterModeRaw = process.env.FORMATTER_MODE ?? "stub";
export type FormatterMode = "stub" | "openai";
export const formatterMode: FormatterMode =
  formatterModeRaw === "openai" ? "openai" : "stub";

export const env = {
  port: process.env.PORT || "5000",
  nodeEnv: process.env.NODE_ENV || "development",
  internalKey: process.env.INTERNAL_KEY! as string,
  formatterMode,
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
};