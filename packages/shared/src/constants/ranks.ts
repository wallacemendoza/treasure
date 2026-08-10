export const MEMBER_RANKS = [
  "support",
  "prospect",
  "full_patch",
] as const;

export type MemberRank = (typeof MEMBER_RANKS)[number];