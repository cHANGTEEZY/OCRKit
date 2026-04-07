import { Router } from "express";
import type { Request, Response } from "express";
import ocrRouter from "./ocr.router.js";

const router = Router();

//* healh check route
router.get("/health-check", (req: Request, res: Response) => {
  res.status(200).json({
    message: "Server is running",
    status: "success",
  });
});

//* ocr route
router.use("/ocr", ocrRouter);

export default router;
