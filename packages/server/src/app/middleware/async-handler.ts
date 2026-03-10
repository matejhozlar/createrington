import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Wraps async route handlers to automatically catch errors and pass them to
 * Express error middleware
 *
 * @param fn - Async route handler function
 * @returns Express request handler that catches and forwards errors
 */
export const asyncHandler = (
  fn:
    | RequestHandler
    | ((req: Request, res: Response, next: NextFunction) => Promise<void>),
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
