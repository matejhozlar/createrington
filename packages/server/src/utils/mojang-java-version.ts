import { z } from "zod";

const VERSION_MANIFEST_URL =
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const REQUEST_TIMEOUT_MS = 10_000;

const versionManifestSchema = z.object({
  versions: z.array(z.object({ id: z.string(), url: z.string().url() })),
});

const versionSchema = z.object({
  javaVersion: z.object({ majorVersion: z.number().int().positive() }),
});

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Mojang version metadata request failed (${res.status})`);
  }
  return res.json();
}

export async function getMinecraftJavaMajorVersion(
  minecraftVersion: string,
): Promise<number | null> {
  const manifest = versionManifestSchema.parse(
    await fetchJson(VERSION_MANIFEST_URL),
  );
  const entry = manifest.versions.find(
    (version) => version.id === minecraftVersion,
  );
  if (!entry) return null;

  const version = versionSchema.safeParse(await fetchJson(entry.url));
  return version.success ? version.data.javaVersion.majorVersion : null;
}
