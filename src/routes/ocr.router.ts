import { Router } from "express";
import type { RequestHandler } from "express";
import {
  ocrRouteController,
  parseUpload,
} from "../controllers/ocr.controller.js";

const ocrRouter = Router();

ocrRouter.post("/parse", parseUpload, ocrRouteController as RequestHandler);

export default ocrRouter;
