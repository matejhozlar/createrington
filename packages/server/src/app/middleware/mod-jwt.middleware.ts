import config from "@/config";
import { UnauthorizedError } from "./error-handler";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

/**
 * JWT secret shared with PresenceAPI and Createrington Currency
 */
const JWT_SECRET = config.app.auth.accessToken.secret;

/**
 * Verify JWT token from mods
 *
 * The mod generates short-lived JWTs (60 seconds) for each request
 * This middleware validates the signature and expiration
 *
 * @throws {UnauthorizedError} if token is missing, invalid, or expired
 */
export const verifyModJWT = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : authHeader;

    if (!token) {
      throw new UnauthorizedError("Mod authentication required");
    }

    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as ModJwtPayload;

    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      throw new UnauthorizedError("Token has expired");
    }

    if (decoded.iat && decoded.iat > now + 60) {
      throw new UnauthorizedError("Token issued in the future");
    }

    req.modAuth = decoded;

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.error("JWT verification failed:", error.message);
      next(new UnauthorizedError("Invalid token"));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError("Token has expired"));
    } else {
      logger.error("Mod JWT verification failed:", error);
      next(new UnauthorizedError("Invalid or expired mod token"));
    }
  }
};
