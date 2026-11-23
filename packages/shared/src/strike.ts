export const STRIKE_CLASSIFICATIONS = [
  "pvp",
  "theft",
  "griefing",
  "laggy_machines",
  "inappropriate_chat",
  "harassment",
  "exploiting",
  "rule_violation",
  "other",
] as const;

export type StrikeClassification = (typeof STRIKE_CLASSIFICATIONS)[number];

export const STRIKE_CLASSIFICATION_LABELS: Record<
  StrikeClassification,
  string
> = {
  pvp: "PvP",
  theft: "Theft",
  griefing: "Griefing",
  laggy_machines: "Laggy Machines",
  inappropriate_chat: "Inappropriate Chat",
  harassment: "Harassment",
  exploiting: "Exploiting",
  rule_violation: "Rule Violation",
  other: "Other",
};
