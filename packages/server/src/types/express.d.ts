import type { JWTPayload } from "@/services/auth/jwt";
import type { ValidatedData } from "@/app/middleware/validation.middleware";

declare global {
  interface ModJwtPayload {
    uuid: string;
    name: string;
    iat: number;
    exp: number;
  }

  namespace Express {
    interface Request {
      user?: JWTPayload;
      clientIp?: string;
      /**
       * Mod JWT payload
       * Set by verifyModJwt middleware
       */
      modAuth?: ModJwtPayload;
      /**
       * Verified server IP address
       * Set by verifyServerIp middleware
       */
      serverIp?: string;
    }
    interface Response {
      locals: {
        validated?: ValidatedData;
        [key: string]: unknown;
      };
    }
  }
}

export {};
