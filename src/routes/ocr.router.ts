import { Router } from "express";
import type { RequestHandler } from "express";
import multer from "multer";
import { ocrController } from "../controllers/ocr.controller.js";

const ocrRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

ocrRouter.post(
  "/parse",
  upload.single("image"),
  ocrController as RequestHandler,
);

export default ocrRouter