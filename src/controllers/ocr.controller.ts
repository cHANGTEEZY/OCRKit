import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { httpError } from "../middlewares/error.middleware.js";
import { extractTextFromImage } from "../services/ocr.service.js";

type OcrRequest = Request & { file?: Express.Multer.File | undefined };

export const ocrController = async (
  req: OcrRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const body = req.body as { image?: string } | undefined;
    const imageFromBody = body?.image;
    const image =
      req.file?.buffer ??
      (typeof imageFromBody === "string" ? imageFromBody : undefined);

    const contentLengthHeader = req.get("content-length");
    const imagePayloadBytes =
      image === undefined
        ? 0
        : Buffer.isBuffer(image)
          ? image.length
          : Buffer.byteLength(image, "utf8");
    const payloadSource = req.file
      ? "multipart"
      : typeof imageFromBody === "string"
        ? "json"
        : "none";
    console.log(
      `[OCR /parse] payload content-length=${contentLengthHeader ?? "n/a"} bytes, imagePayload=${imagePayloadBytes} bytes, source=${payloadSource}`
    );

    if (!image || (Buffer.isBuffer(image) && image.length === 0)) {
      return res.status(400).json({
        message:
          'Send an image as multipart field "image" or JSON body { "image": "<url or data URL>" }',
        status: "error",
        code: "MISSING_IMAGE",
      });
    }

    const result = await extractTextFromImage(image);

    if (result.confidence && result.confidence < 0.5) {
      return res.status(400).json({
        message: "Failed to extract text from image",
        status: "error",
        code: "LOW_CONFIDENCE",
      });
    }

    return res.status(200).json({
      message: "Text extracted successfully",
      status: "success",
      data: result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "OCR processing failed";
    const details =
      env.nodeEnv === "development"
        ? error instanceof Error
          ? { name: error.name, cause: error.cause }
          : { raw: String(error) }
        : undefined;
    next(httpError(500, message, "OCR_EXTRACT_FAILED", details));
  }
};
