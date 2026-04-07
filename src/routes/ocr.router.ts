import { Router } from "express";
import type {  RequestHandler  } from "express";
import { ocrController } from "../controllers/ocr.controller.js";

const ocrRouter = Router()


ocrRouter.post("/parse", ocrController as RequestHandler)

export default ocrRouter