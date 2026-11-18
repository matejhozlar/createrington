import type { JWTPayload } from "@createrington/shared/auth";

export type User = JWTPayload;

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
}
