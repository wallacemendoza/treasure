export interface DashboardCounts {
  active_members: number;
  full_patch: number;
  prospects: number;
  support: number;
  suspended: number;
  on_leave: number;
  upcoming_events: number;
}

export interface ActivityFeedItem {
  id: string;
  action: string;
  actor_username: string | null;
  created_at: string;
}
