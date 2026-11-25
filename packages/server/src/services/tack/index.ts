import jwt from "jsonwebtoken";
import type { JWTPayload } from "@createrington/shared/auth";
import type config from "@/config";

const MAX_NAME_LENGTH = 64;

type TackSigning = Pick<
  NonNullable<typeof config.tack>,
  "secret" | "tokenTtlSeconds"
>;

function discordAvatarUrl(discordId: string, hash: string): string {
  return `https://cdn.discordapp.com/avatars/${discordId}/${hash}.png?size=128`;
}

export function signTackToken(user: JWTPayload, tack: TackSigning): string {
  const name = (user.minecraftUsername || user.username).slice(
    0,
    MAX_NAME_LENGTH,
  );

  return jwt.sign(
    {
      name,
      ...(user.avatar && {
        avatar: discordAvatarUrl(user.discordId, user.avatar),
      }),
    },
    tack.secret,
    {
      algorithm: "HS256",
      subject: user.discordId,
      expiresIn: tack.tokenTtlSeconds,
    },
  );
}
