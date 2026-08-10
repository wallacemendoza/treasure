import type { ActivityFeedItem, DashboardCounts } from "@treasure/shared";
import { supabase } from "../lib/supabase";

const EMPTY_COUNTS: DashboardCounts = {
  active_members: 0,
  full_patch: 0,
  prospects: 0,
  support: 0,
  suspended: 0,
  on_leave: 0,
  upcoming_events: 0,
};

export async function getDashboardCounts(): Promise<DashboardCounts> {
  const { data, error } = await supabase.rpc("get_dashboard_counts");
  if (error) throw new Error(error.message);

  const first = Array.isArray(data) ? data[0] : data;
  return first ?? EMPTY_COUNTS;
}

export async function getRecentActivityFeed(limit = 10): Promise<ActivityFeedItem[]> {
  const { data, error } = await supabase.rpc("get_recent_activity_feed", {
    feed_limit: limit,
  });

  if (error) throw new Error(error.message);
  return data ?? [];
}
