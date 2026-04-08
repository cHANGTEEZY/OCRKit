import Tesseract from "tesseract.js";
import type { OCRResult } from "../types/ocr.type.js";

export const extractTextFromImage = async (
  image: string | Buffer,
): Promise<OCRResult> => {
  const result = await Tesseract.recognize(image, "eng", {
    logger: (m) => console.log(m),
  });
  return {
    text: result.data.text,
    confidence: result.data.confidence,
  };
};

export const formatOCRResultToHandleRequest = (result: OCRResult) => {
  return result.text.split("\n").map((line) => line.trim());
};
