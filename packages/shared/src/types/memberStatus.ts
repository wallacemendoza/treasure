export type MemberStatusType =
  | "suspension"
  | "leave"
  | "probation"
  | "temporary_restriction"
  | "other";

export type MemberStatusState =
  | "active"
  | "ended"
  | "cancelled";

export type MemberStatusDurationPreset =
  | "30_days"
  | "60_days"
  | "90_days"
  | "6_months"
  | "1_year"
  | "indefinite"
  | "custom";

export interface MemberStatusRecord {
  id: string;
  member_id: string;

  type: MemberStatusType;
  reason: string | null;

  start_date: string;
  expected_end_date: string | null;
  actual_end_date: string | null;
  duration_preset: MemberStatusDurationPreset | null;

  status: MemberStatusState;
  notes: string | null;

  created_by: string | null;

  created_at: string;
  updated_at: string;
}