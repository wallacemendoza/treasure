export const ACCESS_ROLES = [
  "viewer",
  "admin",
] as const;

export type AccessRole = (typeof ACCESS_ROLES)[number];