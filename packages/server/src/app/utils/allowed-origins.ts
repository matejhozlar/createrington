import config from "@/config";

export function allowedOrigins(): string[] {
  return config.envMode.isProd
    ? [config.meta.links.website, ...config.app.auth.sso.corsOrigins]
    : [config.app.devClientOrigin];
}
