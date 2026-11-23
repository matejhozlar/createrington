import { CATEGORY_CONFIG, STATUS_CONFIG } from "./constants";
import type {
  PlanningPerson,
  PlanningRevision,
  PlanningSubcategory,
} from "./types";

const PREVIEW_LENGTH = 320;

export function personName(person: PlanningPerson): string {
  return person.minecraftUsername ?? person.discordId;
}

export function subcategoryName(
  subcategories: PlanningSubcategory[],
  id: number | null,
): string | null {
  if (id === null) return null;
  return subcategories.find((s) => s.id === id)?.name ?? "Removed subcategory";
}

export function markdownPreview(markdown: string | null): string {
  if (!markdown) return "";
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s*\|?[\s:|-]*-{3,}[\s:|-]*$/gm, " ")
    .replace(/\|/g, " ")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/^\s*\[[ xX]\]\s+/gm, "")
    .replace(/(\*\*|__|~~|`)/g, "")
    .replace(/(^|\s)[*_]([^*_\n]+)[*_](?=\s|[.,;:!?]|$)/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, PREVIEW_LENGTH);
}

export function describeRevision(
  revision: PlanningRevision,
  previous: PlanningRevision | undefined,
  subcategories: PlanningSubcategory[],
): string[] {
  if (!previous) return ["Created the plan"];

  const changes: string[] = [];
  if (revision.status !== previous.status) {
    changes.push(
      `Moved from ${STATUS_CONFIG[previous.status].label} to ${STATUS_CONFIG[revision.status].label}`,
    );
  }
  if (revision.title !== previous.title) changes.push("Renamed the plan");
  if (revision.category !== previous.category) {
    changes.push(
      `Moved from ${CATEGORY_CONFIG[previous.category].label} to ${CATEGORY_CONFIG[revision.category].label}`,
    );
  }
  if (revision.subcategoryId !== previous.subcategoryId) {
    const next = subcategoryName(subcategories, revision.subcategoryId);
    changes.push(next ? `Filed under ${next}` : "Removed the subcategory");
  }
  if (revision.body !== previous.body) {
    if (!previous.body) changes.push("Wrote the description");
    else if (!revision.body) changes.push("Removed the description");
    else changes.push("Edited the description");
  }
  return changes;
}
