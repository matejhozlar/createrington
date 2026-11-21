import config from "@/config";

export function baseCookieOptions(path: string) {
  return {
    httpOnly: true,
    secure: config.envMode.isProd,
    sameSite: "lax",
    path,
  } as const;
}
