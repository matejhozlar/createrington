import type { Pool, PoolClient } from "pg";
import { ModpackReleaseAnnouncementBaseQueries } from "@/generated/db/modpack_release_announcement.queries";
import type { ModpackReleaseAnnouncement } from "@createrington/shared/db";

export interface ReleaseAnnouncementRow extends ModpackReleaseAnnouncement {
  presetName: string | null;
}

/**
 * Custom queries for modpack_release_announcement table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class ModpackReleaseAnnouncementQueries extends ModpackReleaseAnnouncementBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /** Announcement parts of releases with the name of the preset each one was saved as. */
  async listForReleases(
    releaseIds: number[],
  ): Promise<ReleaseAnnouncementRow[]> {
    if (releaseIds.length === 0) return [];
    const result = await this.runQuery<{
      id: number;
      release_id: number;
      part: number;
      part_count: number;
      preset_id: number | null;
      channel_id: string;
      message_id: string | null;
      created_at: Date;
      sent_at: Date | null;
      preset_name: string | null;
    }>(
      "list release announcements",
      `SELECT a.*, p.name AS preset_name
       FROM ${this.table} a
       LEFT JOIN discord_embed_preset p ON p.id = a.preset_id
       WHERE a.release_id = ANY($1::int[])
       ORDER BY a.release_id, a.part`,
      [releaseIds],
    );
    return result.rows.map((row) => ({
      id: row.id,
      releaseId: row.release_id,
      part: row.part,
      partCount: row.part_count,
      presetId: row.preset_id,
      channelId: row.channel_id,
      messageId: row.message_id,
      createdAt: row.created_at,
      sentAt: row.sent_at,
      presetName: row.preset_name,
    }));
  }
}
