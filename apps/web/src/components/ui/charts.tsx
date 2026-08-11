export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

/**
 * Animated ring chart built from plain SVG stroke-dasharray segments.
 * No charting library needed — keeps the dashboard bundle small and
 * lets every color come straight from the theme's CSS variables.
 */
export function DonutChart({
  segments,
  size = 148,
  strokeWidth = 20,
}: {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let offsetSoFar = 0;

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut-svg">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        {total === 0
          ? null
          : segments.map((segment) => {
              const fraction = segment.value / total;
              const dash = fraction * circumference;
              const gap = circumference - dash;
              const rotation = (offsetSoFar / total) * 360 - 90;
              offsetSoFar += segment.value;

              return (
                <circle
                  key={segment.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dash} ${gap}`}
                  strokeLinecap="butt"
                  className="donut-segment"
                  style={{ transform: `rotate(${rotation}deg)`, transformOrigin: "50% 50%" }}
                />
              );
            })}
      </svg>
      <div className="donut-center">
        <span className="donut-center-value">{total}</span>
        <span className="donut-center-label">Total</span>
      </div>
    </div>
  );
}

export function DonutLegend({ segments }: { segments: DonutSegment[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <ul className="donut-legend">
      {segments.map((segment) => (
        <li key={segment.label} className="donut-legend-item">
          <span className="donut-legend-dot" style={{ background: segment.color }} />
          <span className="donut-legend-label">{segment.label}</span>
          <span className="donut-legend-value">{segment.value}</span>
          <span className="donut-legend-pct">
            {total === 0 ? "0%" : `${Math.round((segment.value / total) * 100)}%`}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ProgressBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100));

  return (
    <div className="progress-row">
      <div className="progress-row-head">
        <span>{label}</span>
        <span className="progress-row-value">{value}</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
