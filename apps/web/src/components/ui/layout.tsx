import type { PropsWithChildren, ReactNode } from "react";
import { cn } from "../../utils/cn";
import { Card } from "./primitives";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  );
}

export function StatCard({ title, value, accent = "neutral" }: { title: string; value: number | string; accent?: "neutral" | "blue" | "green" | "orange" | "red" }) {
  return (
    <Card className={cn("stat-card", `accent-${accent}`)}>
      <p className="stat-title">{title}</p>
      <p className="stat-value">{value}</p>
    </Card>
  );
}

export function DataTable({
  columns,
  children,
}: PropsWithChildren<{ columns: ReactNode }>) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>{columns}</thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
