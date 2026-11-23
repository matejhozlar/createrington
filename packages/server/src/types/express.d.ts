import type { JWTPayload } from "@createrington/shared/auth";
import type { LauncherJwtPayload } from "@/services/auth/launcher/launcher-jwt.service";
import type { ValidatedData } from "@/app/middleware/validation.middleware";

declare global {
  interface ModJwtPayload {
    uuid?: string;
    name?: string;
    aud: string;
    iat: number;
    exp: number;
  }

  namespace Express {
    interface Request {
      user?: JWTPayload;
      modAuth?: ModJwtPayload;
      launcherAuth?: LauncherJwtPayload;
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
