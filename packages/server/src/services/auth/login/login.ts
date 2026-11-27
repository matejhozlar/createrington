import type { Request, Response } from "express";
import { AuthRole, type JWTPayload } from "@createrington/shared/auth";
import config from "@/config";
import { TooManyRequestsError } from "@/errors";
import { adminStatusService } from "@/services/auth/admin-status/admin-status.service";
import { jwtService } from "@/services/auth/jwt/jwt.service";
import { sessionService } from "@/services/auth/session/session.service";
import { issueSsoCode } from "@/services/auth/sso/code-store";
import { accessCookieService } from "@/services/auth/token/access-cookie.service";
import { refreshTokenService } from "@/services/auth/token/refresh-token.service";

export function deriveRole(currentRole: AuthRole, isAdmin: boolean): AuthRole {
  if (currentRole === AuthRole.UNVERIFIED) return AuthRole.UNVERIFIED;
  return isAdmin ? AuthRole.ADMIN : AuthRole.USER;
}

export async function withLiveAdminStatus<T extends JWTPayload>(
  user: T,
): Promise<T> {
  const isAdmin = await adminStatusService.isAdmin(user.discordId);
  return { ...user, isAdmin, role: deriveRole(user.role, isAdmin) };
}

export function toUserDto(user: JWTPayload): JWTPayload {
  return {
    discordId: user.discordId,
    username: user.username,
    avatar: user.avatar,
    role: user.role,
    isAdmin: user.isAdmin,
    minecraftUuid: user.minecraftUuid,
    minecraftUsername: user.minecraftUsername,
  };
}

export async function completeLogin(
  req: Request,
  res: Response,
  user: JWTPayload,
): Promise<string> {
  const accessToken = await jwtService.generate(user);
  const rawRefreshToken = await sessionService.createSession({
    discordId: user.discordId,
    username: user.username,
    avatar: user.avatar,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });

  refreshTokenService.setCookie(res, rawRefreshToken);
  accessCookieService.setCookie(res, accessToken);
  return accessToken;
}

export async function issueSsoCodeFor(user: JWTPayload): Promise<string> {
  const code = await issueSsoCode({
    playerId: user.minecraftUuid,
    minecraftUsername: user.minecraftUsername,
    isMember: user.role !== AuthRole.UNVERIFIED,
    isOwner: user.discordId === config.app.auth.owner.discordId,
  });
  if (!code) {
    throw new TooManyRequestsError("Too many pending sign-in attempts");
  }
  return code;
}
