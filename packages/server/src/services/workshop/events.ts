import { Q } from "@/db";
import type { WorkshopModEventCreate } from "@createrington/shared/db";
import type { WorkshopModReviewAction } from "@createrington/shared/workshop";

export const REVIEW_EVENT_TYPES: Record<
  WorkshopModReviewAction,
  WorkshopModEventCreate["eventType"]
> = {
  approve: "approved",
  start_testing: "testing_started",
  send_back: "sent_back",
  reject: "rejected",
};

/**
 * Record a timeline event for a workshop mod. Fire-and-forget: the write is
 * detached from the caller's request and a failure only warns, so events are
 * at-most-once and must never gate the mutation they describe.
 */
export function recordModEvent(event: WorkshopModEventCreate): void {
  void Q.workshop.mod.event.create(event).catch((error) => {
    logger.warn(
      `Failed to record ${event.eventType} event for workshop mod #${event.workshopModId}:`,
      error,
    );
  });
}
