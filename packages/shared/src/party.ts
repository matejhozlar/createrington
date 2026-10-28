export const PARTY_MEMBER_RANKS = ["owner", "officer", "member"] as const;

export type PartyMemberRank = (typeof PARTY_MEMBER_RANKS)[number];
