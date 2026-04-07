import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

export type AppError = Error & {
  status?: number;
  code?: string;
  details?: unknown;
};

export function httpError(
  status: number,
  message: string,
  code?: string,
  details?: unknown
): AppError {
  const err = new Error(message) as AppError;
  err.status = status;
  if (code !== undefined) {
    err.code = code;
  }
  if (details !== undefined) {
    err.details = details;
  }
  return err;
}

export const errorMiddleware = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const status = err.status ?? 500;
  const isDev = env.nodeEnv === "development";

  console.error(
    `[error] ${status} ${err.code ?? err.name}: ${err.message}`
  );
  if (err.stack) {
    console.error(err.stack);
  }

  res.status(status).json({
    status: "error",
    message: err.message || "Internal server error",
    ...(err.code ? { code: err.code } : {}),
    ...(isDev
      ? {
          debug: {
            name: err.name,
            stack: err.stack,
            ...(err.details !== undefined ? { details: err.details } : {}),
          },
        }
      : {}),
  });
};