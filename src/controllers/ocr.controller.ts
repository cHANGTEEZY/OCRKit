import type { Request, Response } from "express";
import { extractTextFromImage } from "../services/ocr.service.js";


export const ocrController = async (req: Request, res: Response)  => {
 const {image} = req.body as {image: string}

 if(!image) {
    return res.status(400).json({
        message: "Image is required",
        status: "error"
    })
 }

 const result  = await extractTextFromImage(image)

 if(result.confidence && result.confidence < 0.5) {
    return res.status(400).json({
        message: "Failed to extract text from image",
        status: "error"
    })
 }

 return res.status(200).json({
    message: "Text extracted successfully",
    status: "success",
    data: result
 })

}