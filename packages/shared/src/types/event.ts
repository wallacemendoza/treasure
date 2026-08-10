export type AttendanceRequirement = "required" | "optional";

export type EventStatus =
  | "scheduled"
  | "cancelled"
  | "completed";

export interface Event {
  id: string;

  event_name: string;
  description: string | null;
  location: string | null;
  address: string | null;

  starts_at: string;
  ends_at: string | null;

  event_type: string | null;
  organizer_member_id: string | null;

  attendance_requirement: AttendanceRequirement;
  notes: string | null;
  status: EventStatus;

  created_by: string | null;

  created_at: string;
  updated_at: string;
}