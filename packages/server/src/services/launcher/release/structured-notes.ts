import { z } from "zod";
import {
  LAUNCHER_RELEASE_CHANGES_MAX,
  LAUNCHER_RELEASE_CHANGE_TYPE_MAX_LENGTH,
  LAUNCHER_RELEASE_NOTES_MAX_LENGTH,
  type LauncherStructuredNotes,
} from "@createrington/shared/launcher";

const notesText = z.string().min(1).max(LAUNCHER_RELEASE_NOTES_MAX_LENGTH);

export const StructuredNotesSchema = z.object({
  summary: notesText,
  changes: z
    .array(
      z.object({
        type: z.string().min(1).max(LAUNCHER_RELEASE_CHANGE_TYPE_MAX_LENGTH),
        title: notesText,
        description: notesText,
      }),
    )
    .max(LAUNCHER_RELEASE_CHANGES_MAX),
});

export function parseStructuredNotes(
  value: unknown,
): LauncherStructuredNotes | null {
  const parsed = StructuredNotesSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
