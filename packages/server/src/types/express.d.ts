import { ServerInfo } from "@/app/middleware/auth/presence-api.auth";
import { JWTPayload } from "@/services/auth/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      modAuth?: ServerInfo;
      clientIp?: string;
      /**
       * Mod JWT payload
       * Set by verifyModJwt middleware
       */
      modAuth?: {
        iat: number;
        exp: number;
        [key: string]: any;
      };
      /**
       * Verified server IP address
       * Set by verifyServerIp middleware
       */
      serverIp?: string;
      /**
       * Validated zod schema
       * Set by validation middleware
       */
      validatedParams?: any;
      validatedQuery?: any;
      validatedBody?: any;
    }
    interface Response {
      ok<T>(data: T, message?: string): void;
      created<T>(data: T, message?: string): void;
      noContent(): void;
    }
  }
}

export {};
