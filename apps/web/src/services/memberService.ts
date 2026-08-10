import type { Member } from "@treasure/shared";
import { supabase } from "../lib/supabase";
import type { MemberDirectoryRow } from "../types/app";

function isLegacyMemberColumnError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("members.birth_date") ||
    normalized.includes("members.nickname") ||
    normalized.includes("members.prior_balance_due") ||
    normalized.includes("'birth_date' column of 'members'") ||
    normalized.includes('"birth_date" column of "members"') ||
    normalized.includes("'nickname' column of 'members'") ||
    normalized.includes('"nickname" column of "members"') ||
    normalized.includes("'prior_balance_due' column of 'members'") ||
    normalized.includes('"prior_balance_due" column of "members"')
  );
}

function mapLegacyDirectoryRow(
  row: Omit<MemberDirectoryRow, "nickname" | "birth_date" | "prior_balance_due" | "archived_at"> & {
    archived_at?: string | null;
  },
): MemberDirectoryRow {
  return {
    ...row,
    nickname: null,
    birth_date: null,
    prior_balance_due: 0,
    archived_at: row.archived_at ?? null,
  };
}

function mapLegacyMember(member: Omit<Member, "nickname" | "birth_date" | "prior_balance_due">): Member {
  return {
    ...member,
    nickname: null,
    birth_date: null,
    prior_balance_due: 0,
  };
}

export interface MemberPayload {
  full_name: string;
  nickname: string | null;
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
  birth_date: string | null;
  date_joined: string | null;
  notes: string | null;
}

export async function listMembersDirectory(): Promise<MemberDirectoryRow[]> {
  const { data, error } = await supabase.rpc("member_directory");
  if (error) {
    if (!isLegacyMemberColumnError(error.message)) {
      throw new Error(error.message);
    }

    const { data: legacyData, error: legacyError } = await supabase
      .from("members")
      .select("id, full_name, member_rank, active, city, state, photo_url, date_joined")
      .is("archived_at", null)
      .order("full_name", { ascending: true });

    if (legacyError) throw new Error(legacyError.message);

    return (legacyData ?? []).map((row) =>
      mapLegacyDirectoryRow(row as Omit<MemberDirectoryRow, "nickname" | "birth_date" | "prior_balance_due" | "archived_at">),
    );
  }

  const rows = (data ?? []) as Omit<MemberDirectoryRow, "archived_at">[];
  return rows.map((row) => ({
    ...row,
    nickname: row.nickname ?? null,
    birth_date: row.birth_date ?? null,
    prior_balance_due: row.prior_balance_due ?? 0,
    archived_at: null,
  }));
}

export async function listMembersForAdmin(includeArchived: boolean): Promise<MemberDirectoryRow[]> {
  let query = supabase
    .from("members")
    .select("id, full_name, nickname, member_rank, active, city, state, photo_url, birth_date, date_joined, archived_at, prior_balance_due")
    .order("full_name", { ascending: true });

  if (!includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) {
    if (!isLegacyMemberColumnError(error.message)) {
      throw new Error(error.message);
    }

    let legacyQuery = supabase
      .from("members")
      .select("id, full_name, member_rank, active, city, state, photo_url, date_joined, archived_at")
      .order("full_name", { ascending: true });

    if (!includeArchived) {
      legacyQuery = legacyQuery.is("archived_at", null);
    }

    const { data: legacyData, error: legacyError } = await legacyQuery;
    if (legacyError) throw new Error(legacyError.message);

    return (legacyData ?? []).map((row) =>
      mapLegacyDirectoryRow(
        row as Omit<MemberDirectoryRow, "nickname" | "birth_date" | "prior_balance_due"> & { archived_at?: string | null },
      ),
    );
  }

  return (data ?? []) as MemberDirectoryRow[];
}

export async function getMemberByIdForAdmin(memberId: string): Promise<Member | null> {
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("id", memberId)
    .maybeSingle();

  if (error) {
    if (!isLegacyMemberColumnError(error.message)) {
      throw new Error(error.message);
    }

    const { data: legacyData, error: legacyError } = await supabase
      .from("members")
      .select("id, profile_id, full_name, email, phone, street_address, city, state, zip, photo_url, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone, blood_type, member_rank, active, archived_at, date_joined, notes, created_at, updated_at")
      .eq("id", memberId)
      .maybeSingle();

    if (legacyError) throw new Error(legacyError.message);
    return legacyData ? mapLegacyMember(legacyData as Omit<Member, "nickname" | "birth_date" | "prior_balance_due">) : null;
  }

  return data as Member | null;
}

export async function createMemberByAdmin(payload: MemberPayload): Promise<void> {
  const { error } = await supabase.from("members").insert(payload);
  if (!error) return;

  if (!isLegacyMemberColumnError(error.message)) {
    throw new Error(error.message);
  }

  const { birth_date: _birthDate, nickname: _nickname, ...legacyPayload } = payload;
  const { error: legacyError } = await supabase.from("members").insert(legacyPayload);
  if (legacyError) throw new Error(legacyError.message);
}

export async function updateMemberByAdmin(memberId: string, payload: Partial<MemberPayload>): Promise<void> {
  const { error } = await supabase.from("members").update(payload).eq("id", memberId);
  if (!error) return;

  if (!isLegacyMemberColumnError(error.message)) {
    throw new Error(error.message);
  }

  const { birth_date: _birthDate, nickname: _nickname, ...legacyPayload } = payload;
  const { error: legacyError } = await supabase.from("members").update(legacyPayload).eq("id", memberId);
  if (legacyError) throw new Error(legacyError.message);
}

export async function archiveMemberByAdmin(memberId: string): Promise<void> {
  const { error } = await supabase
    .from("members")
    .update({ archived_at: new Date().toISOString(), active: false })
    .eq("id", memberId);

  if (error) throw new Error(error.message);
}
