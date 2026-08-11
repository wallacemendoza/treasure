import type { PropsWithChildren, ReactNode } from "react";
import { cn } from "../../utils/cn";
import { Card } from "./primitives";
import { useCountUp } from "../../hooks/useCountUp";

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

export function StatCard({
  title,
  value,
  accent = "neutral",
  icon,
}: {
  title: string;
  value: number | string;
  accent?: "neutral" | "blue" | "green" | "orange" | "red";
  icon?: ReactNode;
}) {
  const numericValue = typeof value === "number" ? value : Number(value);
  const isAnimatable = typeof value === "number" && Number.isFinite(numericValue);
  const animated = useCountUp(isAnimatable ? numericValue : 0);

  return (
    <Card className={cn("stat-card", `accent-${accent}`)}>
      <div className="stat-card-row">
        <div>
          <p className="stat-title">{title}</p>
          <p className="stat-value">{isAnimatable ? animated : value}</p>
        </div>
        {icon ? <span className={cn("stat-icon", `stat-icon-${accent}`)}>{icon}</span> : null}
      </div>
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
