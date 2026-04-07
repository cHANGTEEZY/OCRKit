import type { Request, Response } from "express";
import { extractTextFromImage } from "../services/ocr.service.js";

type OcrRequest = Request & { file?: Express.Multer.File };

export const ocrController = async (req: OcrRequest, res: Response) => {
  const body = req.body as { image?: string } | undefined;
  const imageFromBody = body?.image;
  const image =
    req.file?.buffer ?? (typeof imageFromBody === "string" ? imageFromBody : undefined);

  if (!image || (Buffer.isBuffer(image) && image.length === 0)) {
    return res.status(400).json({
      message:
        'Send an image as multipart field "image" or JSON body { "image": "<url or data URL>" }',
      status: "error",
    });
  }

  const result = await extractTextFromImage(image);

  if (result.confidence && result.confidence < 0.5) {
    return res.status(400).json({
      message: "Failed to extract text from image",
      status: "error",
    });
  }

  return res.status(200).json({
    message: "Text extracted successfully",
    status: "success",
    data: result,
  });
};
