import { SkinApi } from "createrington-skin-api";
import config from "@/config";

let client: SkinApi | null = null;

export function getSkinApiClient(): SkinApi {
  if (!client) {
    client = new SkinApi({
      baseUrl: config.skinApi.baseUrl,
      userAgent: "createrington-app/1.0",
    });
  }
  return client;
}
