import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = req.headers["x-internal-key"] as string;

  if (!token) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  if (token !== env.internalKey) {
    return res.status(401).json({
      message: "Unauthorized",
      status: "error",
    });
  }

  next();
};
