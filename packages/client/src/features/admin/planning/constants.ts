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
  { label: string; tone: BadgeTone; hint: string }
> = {
  draft: {
    label: "Draft",
    tone: "neutral",
    hint: "Just written down, not up for discussion yet",
  },
  open: { label: "Open", tone: "info", hint: "Being discussed" },
  approved: { label: "Approved", tone: "success", hint: "Agreed by the team" },
  denied: { label: "Denied", tone: "danger", hint: "Turned down by the team" },
};

export const SORT_OPTIONS = [
  {
    value: "edited",
    label: "Last edited",
    orderBy: "updatedAt",
    orderDirection: "desc",
  },
  {
    value: "newest",
    label: "Newest first",
    orderBy: "createdAt",
    orderDirection: "desc",
  },
  {
    value: "oldest",
    label: "Oldest first",
    orderBy: "createdAt",
    orderDirection: "asc",
  },
  {
    value: "title",
    label: "Title A to Z",
    orderBy: "title",
    orderDirection: "asc",
  },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export const PAGE_SIZE = 12;
