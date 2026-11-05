import { ContentGatewayError } from "@createrington/content-gateway-client";
import { contentGateway } from "./index";

/** The major Java version a Minecraft version runs on, as Mojang lists it through the gateway, or null when Mojang does not list the version or names no Java for it. */
export async function getMinecraftJavaMajorVersion(
  minecraftVersion: string,
): Promise<number | null> {
  try {
    const version = await contentGateway().minecraftVersion(minecraftVersion);
    return version.javaMajor ?? null;
  } catch (error) {
    if (
      error instanceof ContentGatewayError &&
      error.code === "UNKNOWN_VERSION"
    ) {
      return null;
    }
    throw error;
  }
}
