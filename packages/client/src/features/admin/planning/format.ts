import type { PlanningCategory } from "@createrington/shared/planning";
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

export function subcategoryNames(
  subcategories: PlanningSubcategory[],
  ids: number[],
): string[] {
  return ids.map(
    (id) =>
      subcategories.find((s) => s.id === id)?.name ?? "Removed subcategory",
  );
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function difference<T>(from: T[], to: T[]): { added: T[]; removed: T[] } {
  return {
    added: to.filter((value) => !from.includes(value)),
    removed: from.filter((value) => !to.includes(value)),
  };
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
  const categories = difference(previous.categories, revision.categories);
  const label = (values: PlanningCategory[]) =>
    listNames(values.map((value) => CATEGORY_CONFIG[value].label));
  if (categories.added.length > 0) {
    changes.push(`Added to ${label(categories.added)}`);
  }
  if (categories.removed.length > 0) {
    changes.push(`Removed from ${label(categories.removed)}`);
  }
  const filed = difference(previous.subcategoryIds, revision.subcategoryIds);
  const names = (ids: number[]) =>
    listNames(subcategoryNames(subcategories, ids));
  if (filed.added.length > 0) {
    changes.push(`Filed under ${names(filed.added)}`);
  }
  if (filed.removed.length > 0) {
    changes.push(`Taken out of ${names(filed.removed)}`);
  }
  if (revision.body !== previous.body) {
    if (!previous.body) changes.push("Wrote the description");
    else if (!revision.body) changes.push("Removed the description");
    else changes.push("Edited the description");
  }
  return changes;
}
