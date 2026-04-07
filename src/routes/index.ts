import { Router } from "express";
import type { Request, Response } from "express";
import ocrRouter from "./ocr.router.js";

const router = Router()


router.get("/health-check", (req: Request,res: Response) => {
    res.status(200).json({
        message: "Server is running",
        status: "success"
    })
})

router.use("ocr", ocrRouter)



export default router