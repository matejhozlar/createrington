import { Q } from "@/db";
import type {
  LauncherPack,
  LauncherPackCreate,
} from "@createrington/shared/db";
import type { WorkshopTestContext } from "./workshop";

export async function seedLauncherPack(
  ctx: WorkshopTestContext,
  row: LauncherPackCreate,
): Promise<LauncherPack> {
  if (!ctx.modpackIds.includes(row.modpackId)) {
    ctx.modpackIds.push(row.modpackId);
  }
  return Q.launcher.pack.createAndReturn(row);
}

export async function cleanupLauncherPacks(
  ctx: WorkshopTestContext,
): Promise<void> {
  if (ctx.modpackIds.length > 0) {
    await Q.launcher.pack.deleteAll({ modpackId: { $in: ctx.modpackIds } });
  }
}
