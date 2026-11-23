import { z } from "zod";

const CURSEFORGE_ID_RE = /^[1-9]\d{0,9}$/;
const CURSEFORGE_ID_MAX = 2_147_483_647;
const VERSION_MAX = 64;

function curseforgeId(message: string) {
  return z
    .string({ error: message })
    .regex(CURSEFORGE_ID_RE, message)
    .transform(Number)
    .refine((id) => id <= CURSEFORGE_ID_MAX, message);
}

const projectId = curseforgeId("project must be a CurseForge project id");

const installedVersion = z
  .string()
  .optional()
  .transform((value) => {
    const version = value?.trim();
    return version && version.length <= VERSION_MAX ? version : undefined;
  });

export const ProjectVersionParamsSchema = z.object({
  project: projectId,
  version: installedVersion,
});

export type ProjectVersionParams = z.infer<typeof ProjectVersionParamsSchema>;

export const ChangelogRowParamsSchema = z.object({
  project: projectId,
  release: curseforgeId("release must be a CurseForge file id"),
  mod: curseforgeId("mod must be a CurseForge project id"),
});

export type ChangelogRowParams = z.infer<typeof ChangelogRowParamsSchema>;
