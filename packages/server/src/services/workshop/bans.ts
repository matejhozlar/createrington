import { db, Q } from "@/db";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/app/middleware/error-handler";
import type { BanType, WorkshopBan } from "@createrington/shared/db";
import type { WorkshopBanWithScope } from "@/db/queries/workshop/ban";
import { DatabaseTable } from "@/generated/db";
import { AdminEdit } from "@/types/enums";

export interface IssueWorkshopBanInput {
  discordId: string;
  workshopId: number | null;
  reason: string;
  durationDays?: number;
}

export interface WorkshopBanActor {
  discordId: string;
  username: string;
}

/**
 * Human-readable reason a suggestion was refused, safe to show the banned user.
 * Callers that can render a timezone-aware date pass their own formatter; the
 * default spells out UTC rather than reading a day off for western users.
 */
export function banNotice(
  ban: WorkshopBan,
  formatExpiry: (expiresAt: Date) => string = (expiresAt) =>
    `${expiresAt.toISOString().slice(0, 10)} (UTC)`,
): string {
  const scope = ban.workshopId ? "in this workshop" : "across every workshop";
  const until = ban.expiresAt
    ? `until ${formatExpiry(ban.expiresAt)}`
    : "permanently";
  return `You are blocked from suggesting mods ${scope} ${until}. Reason: ${ban.reason}`;
}

/**
 * Throw if an active ban blocks this user from suggesting into this workshop.
 * Upvotes, ballots and withdrawing existing suggestions are never affected.
 */
export async function assertCanSuggest(
  discordId: string,
  workshopId: number,
): Promise<void> {
  const ban = await Q.workshop.ban.findActiveFor(discordId, workshopId);
  if (ban) throw new ForbiddenError(banNotice(ban));
}

/** Active ban blocking this user in this workshop, for pre-flight checks. */
export async function findSuggestBan(
  discordId: string,
  workshopId: number,
): Promise<WorkshopBan | null> {
  return Q.workshop.ban.findActiveFor(discordId, workshopId);
}

/**
 * Ban a user from suggesting, scoped to one workshop or globally when
 * workshopId is null. Rejects if an active ban already covers that exact
 * scope; a global and a scoped ban can coexist.
 */
export async function issueBan(
  input: IssueWorkshopBanInput,
  actor: WorkshopBanActor,
): Promise<WorkshopBan> {
  if (input.workshopId !== null) {
    const workshop = await Q.workshop.find({ id: input.workshopId });
    if (!workshop) {
      throw new NotFoundError(`Workshop #${input.workshopId} not found`);
    }
  }

  const existing = await Q.workshop.ban.findActiveInScope(
    input.discordId,
    input.workshopId,
  );
  if (existing) {
    throw new ConflictError(
      `Already banned in this scope (ban #${existing.id}), lift it first`,
    );
  }

  const banType: BanType =
    input.durationDays === undefined ? "permanent" : "temporary";
  let expiresAt: Date | undefined;
  if (banType === "temporary") {
    if (!input.durationDays || input.durationDays <= 0) {
      throw new BadRequestError("Ban duration must be at least one day");
    }
    expiresAt = new Date(Date.now() + input.durationDays * 86_400_000);
  }

  const player = await Q.player.find({ discordId: input.discordId });

  return db.inTransaction(async (tx) => {
    const ban = await tx.workshop.ban.createAndReturn({
      discordId: input.discordId,
      workshopId: input.workshopId,
      banType,
      reason: input.reason,
      bannedByDiscordId: actor.discordId,
      bannedByUsername: actor.username,
      expiresAt,
    });

    await tx.admin.log.action.create({
      adminDiscordId: actor.discordId,
      adminUsername: actor.username,
      actionType: AdminEdit.BAN_WORKSHOP_SUGGEST,
      targetPlayerUuid: player?.minecraftUuid ?? null,
      targetPlayerName: player?.minecraftUsername ?? null,
      tableName: DatabaseTable.WORKSHOP_BAN.TABLE,
      fieldName: DatabaseTable.WORKSHOP_BAN.FIELDS.BAN_TYPE,
      oldValue: null,
      newValue: banType,
      reason: input.reason,
      metadata: {
        banId: ban.id,
        workshopId: input.workshopId,
        expiresAt: expiresAt?.toISOString() ?? null,
      },
    });

    logger.info(
      `Workshop suggestion ban #${ban.id} issued to ${input.discordId} by ${actor.username} (scope: ${input.workshopId ?? "global"}, ${expiresAt ? expiresAt.toISOString() : "permanent"})`,
    );

    return ban;
  });
}

/** Lift a workshop suggestion ban, leaving the row as history. */
export async function liftBan(
  banId: number,
  reason: string,
  actor: WorkshopBanActor,
): Promise<WorkshopBan> {
  const ban = await Q.workshop.ban.find({ id: banId });
  if (!ban) throw new NotFoundError(`Workshop ban #${banId} not found`);
  if (ban.unbanned) {
    throw new ConflictError(`Workshop ban #${banId} was already lifted`);
  }

  const player = await Q.player.find({ discordId: ban.discordId });

  return db.inTransaction(async (tx) => {
    const lifted = await tx.workshop.ban.updateAndReturn(
      { id: banId },
      {
        unbanned: true,
        unbannedByDiscordId: actor.discordId,
        unbannedByUsername: actor.username,
        unbannedAt: new Date(),
        unbanReason: reason,
      },
    );

    await tx.admin.log.action.create({
      adminDiscordId: actor.discordId,
      adminUsername: actor.username,
      actionType: AdminEdit.UNBAN_WORKSHOP_SUGGEST,
      targetPlayerUuid: player?.minecraftUuid ?? null,
      targetPlayerName: player?.minecraftUsername ?? null,
      tableName: DatabaseTable.WORKSHOP_BAN.TABLE,
      fieldName: DatabaseTable.WORKSHOP_BAN.FIELDS.UNBANNED,
      oldValue: "false",
      newValue: "true",
      reason,
      metadata: { banId, workshopId: ban.workshopId },
    });

    logger.info(
      `Workshop suggestion ban #${banId} lifted by ${actor.username}`,
    );

    return lifted;
  });
}

/** A user's workshop bans, newest first, for the admin player detail tab. */
export async function listBansForUser(
  discordId: string,
  includeInactive: boolean,
): Promise<WorkshopBanWithScope[]> {
  return Q.workshop.ban.listForUser(discordId, includeInactive);
}
