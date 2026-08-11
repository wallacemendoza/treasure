import { useCallback, useEffect, useState } from "react";
import type { ActivityFeedItem, DashboardCounts } from "@treasure/shared";
import {
  Card,
  DonutChart,
  DonutLegend,
  EmptyState,
  ErrorState,
  IconAlert,
  IconCalendar,
  IconPatch,
  IconPause,
  IconProspect,
  IconSupport,
  IconUsers,
  PageHeader,
  ProgressBar,
  StatCard,
  getActivityIcon,
} from "../../components/ui";
import { getDashboardCounts, getRecentActivityFeed } from "../../services/dashboardService";
import { formatDateTime, formatRelativeTime, toTitleCase } from "../../utils/format";

function DashboardSkeleton() {
  return (
    <div className="stack-xl">
      <PageHeader title="Dashboard" subtitle="Chapter overview and current activity" />
      <section className="stats-grid" aria-hidden="true">
        {Array.from({ length: 7 }).map((_, idx) => (
          <div key={idx} className="card stat-card skeleton-card">
            <div className="skeleton-line skeleton-line-sm" />
            <div className="skeleton-line skeleton-line-lg" />
          </div>
        ))}
      </section>
      <div className="dashboard-lower-grid">
        <div className="card skeleton-card" style={{ height: 260 }} />
        <div className="card skeleton-card" style={{ height: 260 }} />
      </div>
    </div>
  );
}

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
    return <DashboardSkeleton />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void loadDashboard()} />;
  }

  const rankSegments = [
    { label: "Full Patch", value: counts?.full_patch ?? 0, color: "var(--gold-bright)" },
    { label: "Prospect", value: counts?.prospects ?? 0, color: "var(--blue)" },
    { label: "Support", value: counts?.support ?? 0, color: "var(--success)" },
  ];

  const activeMembers = counts?.active_members ?? 0;

  return (
    <div className="stack-xl">
      <PageHeader title="Dashboard" subtitle="Chapter overview and current activity" />

      <section className="stats-grid" aria-label="Dashboard counts">
        {[
          { title: "Total Active Members", value: counts?.active_members ?? 0, accent: "blue" as const, icon: <IconUsers /> },
          { title: "Full Patch", value: counts?.full_patch ?? 0, accent: "orange" as const, icon: <IconPatch /> },
          { title: "Prospects", value: counts?.prospects ?? 0, accent: "blue" as const, icon: <IconProspect /> },
          { title: "Support", value: counts?.support ?? 0, accent: "neutral" as const, icon: <IconSupport /> },
          { title: "Currently Suspended", value: counts?.suspended ?? 0, accent: "red" as const, icon: <IconAlert /> },
          { title: "Currently On Leave", value: counts?.on_leave ?? 0, accent: "orange" as const, icon: <IconPause /> },
          { title: "Upcoming Events", value: counts?.upcoming_events ?? 0, accent: "blue" as const, icon: <IconCalendar /> },
        ].map((stat, idx) => (
          <div key={stat.title} className="stat-card-enter" style={{ animationDelay: `${idx * 45}ms` }}>
            <StatCard title={stat.title} value={stat.value} accent={stat.accent} icon={stat.icon} />
          </div>
        ))}
      </section>

      <div className="dashboard-lower-grid">
        <Card>
          <div className="section-heading">
            <h2>Membership Breakdown</h2>
          </div>
          <div className="donut-panel">
            <DonutChart segments={rankSegments} />
            <DonutLegend segments={rankSegments} />
          </div>
        </Card>

        <Card>
          <div className="section-heading">
            <h2>Chapter Health</h2>
          </div>
          <div className="stack-md" style={{ marginTop: "var(--space-2)" }}>
            <ProgressBar label="Suspended" value={counts?.suspended ?? 0} max={activeMembers} color="var(--danger)" />
            <ProgressBar label="On Leave" value={counts?.on_leave ?? 0} max={activeMembers} color="var(--gold)" />
            <ProgressBar
              label="In Good Standing"
              value={Math.max(activeMembers - (counts?.suspended ?? 0) - (counts?.on_leave ?? 0), 0)}
              max={activeMembers}
              color="var(--success)"
            />
          </div>
        </Card>
      </div>

      <Card>
        <div className="section-heading">
          <h2>Recent Activity</h2>
        </div>

        {activity.length === 0 ? (
          <EmptyState title="No activity yet" description="Activity updates will appear here once members, events, or status records change." />
        ) : (
          <ul className="activity-list">
            {activity.map((item) => {
              const { Icon, tone } = getActivityIcon(item.action);
              return (
                <li key={item.id} className="activity-item">
                  <div className="activity-item-main">
                    <span className={`activity-icon activity-icon-${tone}`}>
                      <Icon width={16} height={16} />
                    </span>
                    <div>
                      <p className="activity-action">{toTitleCase(item.action)}</p>
                      <p className="activity-meta">By {item.actor_username ?? "system"}</p>
                    </div>
                  </div>
                  <time className="activity-date" dateTime={item.created_at} title={formatDateTime(item.created_at)}>
                    {formatRelativeTime(item.created_at)}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default Dashboard;
