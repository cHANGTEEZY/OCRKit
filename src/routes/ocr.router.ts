import { Router } from "express";
import type { Request, Response } from "express";

const ocrRouter = Router()


ocrRouter.post("/parse", async (req: Request,res: Response) => {
    const { image } = req.body
    // const result = await ocr(image)

    const result  = {
        text: "Hello, world!",
        confidence: 0.95
    }
    res.status(200).json({
        message: "Image parsed successfully",
        status: "success",
        data: result
    })
})

export default ocrRouter