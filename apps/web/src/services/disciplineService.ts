import type { MemberStatusRecord } from "@treasure/shared";
import { supabase } from "../lib/supabase";

export async function listStatusRecords() {
  const { data, error } = await supabase
    .from("member_status_records")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as MemberStatusRecord[];
}

export async function createStatusRecordByAdmin(payload: Omit<MemberStatusRecord, "id" | "created_at" | "updated_at" | "created_by">) {
  const { error } = await supabase.from("member_status_records").insert(payload);
  if (error) throw new Error(error.message);
}

export async function updateStatusRecordByAdmin(recordId: string, payload: Partial<MemberStatusRecord>) {
  const { error } = await supabase.from("member_status_records").update(payload).eq("id", recordId);
  if (error) throw new Error(error.message);
}
