import { db, Q } from "@/db/pool";
import { NIL_UUID } from "@/utils/player-identifier";
import { DatabaseTable } from "@/generated/db";

/**
 * Audited deletion of waitlist entries. Queue orchestration (promotion,
 * pings, channel lifecycle), capacity and the admin-channel progress embed
 * live in the waitlist services.
 */
export class WaitlistRepository {
  /** Hard-delete a waitlist entry and write the matching admin_log_action in one transaction. */
  async adminDelete(
    entryId: number,
    adminDiscordId: string,
    adminUsername: string,
    reason: string,
  ): Promise<void> {
    const entry = await Q.waitlist.entry.get({ id: entryId });

    await db.inTransaction(async (tx) => {
      await tx.admin.log.action.create({
        adminDiscordId,
        adminUsername,
        actionType: "delete_waitlist",
        targetPlayerUuid: NIL_UUID,
        targetPlayerName: entry.discordUsername,
        tableName: DatabaseTable.WAITLIST_ENTRY.TABLE,
        fieldName: "deleted",
        oldValue: "false",
        newValue: "true",
        reason,
        metadata: {
          discordId: entry.discordId,
          discordUsername: entry.discordUsername,
          status: entry.status,
        },
      });

      await tx.waitlist.entry.delete({ id: entryId });

      logger.info(
        `Admin ${adminUsername} deleted waitlist entry #${entryId} (${entry.discordUsername})`,
      );
    });
  }
}
