import type { NextFunction, Request, RequestHandler, Response } from "express";
import { env } from "../config/env.js";
import { httpError } from "../middlewares/error.middleware.js";
import {
  FormatterError,
  formatDocumentSource,
  type FormatDocumentInput,
} from "../services/formatter.service.js";
import { extractTextFromImage } from "../services/ocr.service.js";
import { UnsupportedDocumentVariantError } from "../schemas/documentRegistry.js";
import { parseFormatOptions } from "../utils/parseFormatOptions.js";
import multer from "multer";

type OcrRequest = Request & { file?: Express.Multer.File | undefined };

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 },
});

export const parseUpload: RequestHandler = (
  req: OcrRequest,
  res: Response,
  next: NextFunction,
) => {
  upload.single("image")(req, res, (err: any) => {
    if (!err) {
      return next();
    }
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(
          httpError(413, "Image exceeds 40MB limit", "LIMIT_FILE_SIZE", {
            multerCode: err.code,
          }),
        );
      }
      return next(
        httpError(400, err.message, err.code, { multerCode: err.code }),
      );
    }
    return next(
      httpError(400, (err as Error).message || "Upload failed", "UPLOAD_ERROR"),
    );
  });
};

export const ocrRouteController = async (
  req: OcrRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const body = req.body as Record<string, unknown> | undefined;
    const formatOpts = parseFormatOptions(body);
    if (!formatOpts.ok) {
      return res.status(400).json({
        message: formatOpts.message,
        status: "error",
        code: formatOpts.code,
      });
    }

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
      `[OCR /parse] payload content-length=${contentLengthHeader ?? "n/a"} bytes, imagePayload=${imagePayloadBytes} bytes, source=${payloadSource}`,
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

    const lowConfidence =
      result.confidence !== undefined && result.confidence < 0.5;
    if (lowConfidence && !formatOpts.value.wantsFormat) {
      return res.status(400).json({
        message: "Failed to extract text from image",
        status: "error",
        code: "LOW_CONFIDENCE",
      });
    }

    type OcrData = typeof result & {
      formatted?: { data: Record<string, unknown>; meta: unknown };
    };

    const data: OcrData = { ...result };

    if (formatOpts.value.wantsFormat && formatOpts.value.documentType) {
      try {
        const fmtInput: FormatDocumentInput = {
          rawText: result.text,
          documentType: formatOpts.value.documentType,
          responseProfile: formatOpts.value.responseProfile,
          strictMode: formatOpts.value.strictMode,
        };
        if (result.confidence !== undefined) {
          fmtInput.confidence = result.confidence;
        }
        const cfs = formatOpts.value.clientRequestedFields;
        if (cfs !== undefined) {
          fmtInput.clientRequestedFields = cfs;
        }
        const formatted = await formatDocumentSource(fmtInput);
        data.formatted = formatted;
      } catch (err) {
        if (err instanceof UnsupportedDocumentVariantError) {
          return res.status(400).json({
            message: err.message,
            status: "error",
            code: err.code,
          });
        }
        if (err instanceof FormatterError) {
          const status = err.code === "FORMATTER_CONFIG" ? 500 : 422;
          return res.status(status).json({
            message: err.message,
            status: "error",
            code: err.code,
          });
        }
        throw err;
      }
    }

    console.log("Data", JSON.stringify(data, null, Infinity));

    return res.status(200).json({
      message: "Text extracted successfully",
      status: "success",
      data,
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
