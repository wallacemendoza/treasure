import type { Member } from "@treasure/shared";
import { supabase } from "../lib/supabase";
import type { MemberDirectoryRow } from "../types/app";

export interface MemberPayload {
  full_name: string;
  email: string | null;
  phone: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  photo_url: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_phone: string | null;
  blood_type: string | null;
  member_rank: Member["member_rank"];
  active: boolean;
  date_joined: string | null;
  notes: string | null;
}

export async function listMembersDirectory(): Promise<MemberDirectoryRow[]> {
  const { data, error } = await supabase.rpc("member_directory");
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Omit<MemberDirectoryRow, "archived_at">[];
  return rows.map((row) => ({ ...row, archived_at: null }));
}

export async function listMembersForAdmin(includeArchived: boolean): Promise<MemberDirectoryRow[]> {
  let query = supabase
    .from("members")
    .select("id, full_name, member_rank, active, city, state, photo_url, date_joined, archived_at, prior_balance_due")
    .order("full_name", { ascending: true });

  if (!includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as MemberDirectoryRow[];
}

export async function getMemberByIdForAdmin(memberId: string): Promise<Member | null> {
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("id", memberId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as Member | null;
}

export async function createMemberByAdmin(payload: MemberPayload): Promise<void> {
  const { error } = await supabase.from("members").insert(payload);
  if (error) throw new Error(error.message);
}

export async function updateMemberByAdmin(memberId: string, payload: Partial<MemberPayload>): Promise<void> {
  const { error } = await supabase.from("members").update(payload).eq("id", memberId);
  if (error) throw new Error(error.message);
}

export async function archiveMemberByAdmin(memberId: string): Promise<void> {
  const { error } = await supabase
    .from("members")
    .update({ archived_at: new Date().toISOString(), active: false })
    .eq("id", memberId);

  if (error) throw new Error(error.message);
}
