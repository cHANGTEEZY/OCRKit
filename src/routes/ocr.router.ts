import { Router } from "express";
import type { RequestHandler } from "express";
import multer from "multer";
import { ocrController } from "../controllers/ocr.controller.js";
import { httpError } from "../middlewares/error.middleware.js";

const ocrRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 }, 
});

const parseUpload: RequestHandler = (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (!err) {
      return next();
    }
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(
          httpError(
            413,
            "Image exceeds 40MB limit",
            "LIMIT_FILE_SIZE",
            { multerCode: err.code }
          )
        );
      }
      return next(
        httpError(400, err.message, err.code, { multerCode: err.code })
      );
    }
    return next(
      httpError(400, (err as Error).message || "Upload failed", "UPLOAD_ERROR")
    );
  });
};

ocrRouter.post("/parse", parseUpload, ocrController as RequestHandler);

export default ocrRouter;