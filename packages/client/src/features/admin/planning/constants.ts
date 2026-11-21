import type { BadgeTone } from "@/components/ui/badge";
import type {
  PlanningCategory,
  PlanningItemStatus,
} from "@createrington/shared/planning";

export const CATEGORY_CONFIG: Record<
  PlanningCategory,
  { label: string; tone: BadgeTone }
> = {
  modpack: { label: "Modpack", tone: "orange" },
  website: { label: "Website", tone: "info" },
  discord: { label: "Discord", tone: "violet" },
  server: { label: "Server", tone: "teal" },
};

export const STATUS_CONFIG: Record<
  PlanningItemStatus,
  { label: string; hint: string }
> = {
  inbox: { label: "Inbox", hint: "New, not talked about yet" },
  discussing: { label: "Discussing", hint: "Being talked through" },
  decided: { label: "Decided", hint: "Agreed, not started" },
  building: { label: "Building", hint: "Being worked on" },
  done: { label: "Done", hint: "Finished" },
  rejected: { label: "Rejected", hint: "Decided against" },
};

export const OPEN_STATUSES = [
  "inbox",
  "discussing",
  "decided",
  "building",
  "done",
] as const satisfies readonly PlanningItemStatus[];

export const NO_SUBCATEGORY = "none";
