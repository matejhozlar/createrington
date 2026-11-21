import type { PlanningItemStatus } from "@createrington/shared/planning";
import { CATEGORY_CONFIG, STATUS_CONFIG } from "./constants";
import type {
  PlanningPerson,
  PlanningRevision,
  PlanningSubcategory,
} from "./types";

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

export function statusLabel(status: PlanningItemStatus): string {
  return STATUS_CONFIG[status].label;
}

function describeText(
  field: string,
  before: string | null,
  after: string | null,
): string {
  if (!before) return `Wrote the ${field}`;
  if (!after) return `Removed the ${field}`;
  return `Edited the ${field}`;
}

export function describeRevision(
  revision: PlanningRevision,
  previous: PlanningRevision | undefined,
  subcategories: PlanningSubcategory[],
): string[] {
  if (!previous) return ["Created the card"];

  const changes: string[] = [];
  if (revision.status !== previous.status) {
    changes.push(
      `Moved from ${statusLabel(previous.status)} to ${statusLabel(revision.status)}`,
    );
  }
  if (revision.title !== previous.title) changes.push("Renamed the card");
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
    changes.push(describeText("details", previous.body, revision.body));
  }
  if (revision.decision !== previous.decision) {
    changes.push(
      describeText("decision", previous.decision, revision.decision),
    );
  }
  return changes;
}
