ALTER TABLE "faq_welcome_message" RENAME TO "discord_sticky_message";--> statement-breakpoint
ALTER SEQUENCE "faq_welcome_message_id_seq" RENAME TO "discord_sticky_message_id_seq";--> statement-breakpoint
ALTER TABLE "discord_sticky_message" RENAME CONSTRAINT "faq_welcome_message_pkey" TO "discord_sticky_message_pkey";--> statement-breakpoint
ALTER TABLE "discord_sticky_message" RENAME CONSTRAINT "faq_welcome_message_channel_id_unique" TO "discord_sticky_message_channel_id_unique";
