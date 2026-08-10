export type MemberStatusType =
  | "suspension"
  | "leave"
  | "probation"
  | "temporary_restriction"
  | "other";

export type MemberStatusState =
  | "active"
  | "completed"
  | "cancelled";

export interface MemberStatusRecord {
  id: string;
  member_id: string;

  type: MemberStatusType;
  reason: string;

  start_date: string;
  expected_end_date: string | null;
  actual_end_date: string | null;

  status: MemberStatusState;
  notes: string | null;

  created_by: string | null;

  created_at: string;
  updated_at: string;
}