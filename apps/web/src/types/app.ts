import type { ActivityFeedItem, DashboardCounts, Member, Profile } from "@treasure/shared";

export type AccessRole = Profile["access_role"];

export interface AuthState {
  sessionReady: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  profile: Profile | null;
  role: AccessRole | null;
}

export interface MemberDirectoryRow {
  id: string;
  full_name: string;
  member_rank: Member["member_rank"];
  active: boolean;
  city: string | null;
  state: string | null;
  photo_url: string | null;
  date_joined: string | null;
  archived_at: string | null;
}

export interface DashboardState {
  counts: DashboardCounts | null;
  activity: ActivityFeedItem[];
}
