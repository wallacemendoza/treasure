import { useCallback, useEffect, useState } from "react";
import type { ActivityFeedItem, DashboardCounts } from "@treasure/shared";
import { ErrorState, LoadingSpinner, PageHeader, StatCard, EmptyState, Card } from "../../components/ui";
import { getDashboardCounts, getRecentActivityFeed } from "../../services/dashboardService";
import { formatDateTime, toTitleCase } from "../../utils/format";

function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [activity, setActivity] = useState<ActivityFeedItem[]>([]);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [countsData, activityData] = await Promise.all([
        getDashboardCounts(),
        getRecentActivityFeed(10),
      ]);

      setCounts(countsData);
      setActivity(activityData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (isLoading) {
    return <LoadingSpinner label="Loading dashboard..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void loadDashboard()} />;
  }

  return (
    <div className="stack-xl">
      <PageHeader
        title="Dashboard"
        subtitle="Chapter overview and current activity"
      />

      <section className="stats-grid" aria-label="Dashboard counts">
        <StatCard title="Total Active Members" value={counts?.active_members ?? 0} accent="blue" />
        <StatCard title="Full Patch" value={counts?.full_patch ?? 0} accent="orange" />
        <StatCard title="Prospects" value={counts?.prospects ?? 0} accent="blue" />
        <StatCard title="Support" value={counts?.support ?? 0} />
        <StatCard title="Currently Suspended" value={counts?.suspended ?? 0} accent="red" />
        <StatCard title="Currently On Leave" value={counts?.on_leave ?? 0} accent="orange" />
        <StatCard title="Upcoming Events" value={counts?.upcoming_events ?? 0} accent="blue" />
      </section>

      <Card>
        <div className="section-heading">
          <h2>Recent Activity</h2>
        </div>

        {activity.length === 0 ? (
          <EmptyState title="No activity yet" description="Activity updates will appear here once members, events, or status records change." />
        ) : (
          <ul className="activity-list">
            {activity.map((item) => (
              <li key={item.id} className="activity-item">
                <div>
                  <p className="activity-action">{toTitleCase(item.action)}</p>
                  <p className="activity-meta">By {item.actor_username ?? "system"}</p>
                </div>
                <time className="activity-date" dateTime={item.created_at}>
                  {formatDateTime(item.created_at)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default Dashboard;