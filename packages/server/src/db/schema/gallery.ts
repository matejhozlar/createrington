import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { gallerySubmissionStatusEnum } from "./enums";
import { player, playerBalanceTransaction } from "./player";
import { server } from "./server";

// --- gallery_submission ---
// One row per image attachment harvested from the Discord intake channel;
// images posted in the same message share source_message_id. original_path
// is relative to the private originals directory and is never served
// publicly; full_key / thumb_key are object storage keys filled on approval.
// reward_transaction_id is set exactly once when the approval reward is paid.

export const gallerySubmission = pgTable(
  "gallery_submission",
  {
    id: serial("id").primaryKey(),
    status: gallerySubmissionStatusEnum("status").notNull().default("pending"),
    playerMinecraftUuid: uuid("player_minecraft_uuid")
      .notNull()
      .references(() => player.minecraftUuid, {
        onUpdate: "cascade",
        onDelete: "cascade",
      }),
    serverId: integer("server_id").references(() => server.id, {
      onDelete: "set null",
    }),
    caption: text("caption"),
    sourceChannelId: text("source_channel_id").notNull(),
    sourceMessageId: text("source_message_id").notNull(),
    sourceAttachmentId: text("source_attachment_id").notNull(),
    originalPath: text("original_path").notNull(),
    originalContentType: text("original_content_type").notNull(),
    originalBytes: integer("original_bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    fullKey: text("full_key"),
    thumbKey: text("thumb_key"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectNote: text("reject_note"),
    rewardAmount: integer("reward_amount"),
    rewardTransactionId: integer("reward_transaction_id").references(
      () => playerBalanceTransaction.id,
      { onDelete: "set null" },
    ),
    announcementChannelId: text("announcement_channel_id"),
    announcementMessageId: text("announcement_message_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_gallery_submission_status_created").on(
      table.status,
      table.createdAt.desc(),
    ),
    index("idx_gallery_submission_player").on(table.playerMinecraftUuid),
    uniqueIndex("idx_gallery_submission_source").on(
      table.sourceMessageId,
      table.sourceAttachmentId,
    ),
  ],
);

// --- gallery_submission_credit ---
// Extra players credited on a published image (shared builds). Display
// only: the approval reward goes to the submitter.

export const gallerySubmissionCredit = pgTable(
  "gallery_submission_credit",
  {
    id: serial("id").primaryKey(),
    submissionId: integer("submission_id")
      .notNull()
      .references(() => gallerySubmission.id, { onDelete: "cascade" }),
    playerMinecraftUuid: uuid("player_minecraft_uuid")
      .notNull()
      .references(() => player.minecraftUuid, {
        onUpdate: "cascade",
        onDelete: "cascade",
      }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_gallery_submission_credit_unique").on(
      table.submissionId,
      table.playerMinecraftUuid,
    ),
  ],
);
