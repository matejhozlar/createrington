export const FAQ_MATCH_MODES = ["keywords", "regex"] as const;

export type FaqMatchMode = (typeof FAQ_MATCH_MODES)[number];
