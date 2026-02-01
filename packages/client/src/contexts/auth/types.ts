import type { JWTPayload } from "@createrington/shared/auth";

export type User = JWTPayload;

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: () => void;
  logout: () => void;
  refreshToken: () => Promise<void>;
}
