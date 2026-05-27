import { SkinApiClient } from "@createrington/skin-api-client";
import config from "@/config";

let client: SkinApiClient | null = null;

export function getSkinApiClient(): SkinApiClient {
  if (!client) {
    client = new SkinApiClient({
      baseUrl: config.skinApi.baseUrl,
      apiKey: config.skinApi.apiKey,
      userAgent: "createrington-app/1.0",
    });
  }
  return client;
}
