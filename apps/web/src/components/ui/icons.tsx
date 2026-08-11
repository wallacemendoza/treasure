import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconUsers(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="10" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function IconPatch(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 2 3 6v6c0 5 3.8 8.4 9 10 5.2-1.6 9-5 9-10V6l-9-4Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function IconProspect(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a8 8 0 0 1 8-8" />
      <path d="M18 14v6M15 17h6" />
    </svg>
  );
}

export function IconSupport(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M11 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M13.5 14H9a4 4 0 0 0-4 4v1h13v-1a4 4 0 0 0-3-3.87" />
      <path d="M16 8a3 3 0 1 1 0 6" />
      <path d="M18 14h.5A3.5 3.5 0 0 1 22 17.5V19h-2" />
    </svg>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10.3 3.9 1.8 18a1.5 1.5 0 0 0 1.3 2.2h17.8a1.5 1.5 0 0 0 1.3-2.2L13.7 3.9a1.5 1.5 0 0 0-2.6 0Z" />
      <path d="M12 9v4M12 16.5v.01" />
    </svg>
  );
}

export function IconPause(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M10 9v6M14 9v6" />
    </svg>
  );
}

export function IconCalendar(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2" />
      <path d="M16 2.5v4M8 2.5v4M3 9.5h18" />
    </svg>
  );
}

export function IconMemberPlus(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21v-1a7 7 0 0 1 7-7" />
      <path d="M17 8v6M14 11h6" />
    </svg>
  );
}

export function IconEdit(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function IconShieldChange(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 2 3 6v6c0 5 3.8 8.4 9 10 5.2-1.6 9-5 9-10V6l-9-4Z" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

export function IconCash(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M6 6v0M18 18v0" />
    </svg>
  );
}

export function IconRank(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 21V10M12 21V4M20 21v-7" />
    </svg>
  );
}

/** Maps activity_log action strings to an icon + accent tone. */
export function getActivityIcon(action: string) {
  switch (action) {
    case "member_created":
      return { Icon: IconMemberPlus, tone: "blue" as const };
    case "member_edited":
      return { Icon: IconEdit, tone: "neutral" as const };
    case "member_archived":
      return { Icon: IconAlert, tone: "red" as const };
    case "rank_changed":
      return { Icon: IconRank, tone: "orange" as const };
    case "permissions_changed":
      return { Icon: IconShieldChange, tone: "orange" as const };
    case "suspension_created":
      return { Icon: IconAlert, tone: "red" as const };
    case "suspension_ended":
      return { Icon: IconPatch, tone: "green" as const };
    case "leave_created":
      return { Icon: IconPause, tone: "orange" as const };
    case "leave_ended":
      return { Icon: IconPatch, tone: "green" as const };
    case "event_created":
    case "event_edited":
      return { Icon: IconCalendar, tone: "blue" as const };
    case "dues_payment_updated":
      return { Icon: IconCash, tone: "green" as const };
    default:
      return { Icon: IconEdit, tone: "neutral" as const };
  }
}
