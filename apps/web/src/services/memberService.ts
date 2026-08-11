import type { Member } from "@treasure/shared";
import { supabase } from "../lib/supabase";
import type { MemberDirectoryRow } from "../types/app";

function isLegacyMemberColumnError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("members.birth_date") ||
    normalized.includes("members.full_patch_since") ||
    normalized.includes("members.dues_mandatory") ||
    normalized.includes("members.nickname") ||
    normalized.includes("members.motorcycle_brand") ||
    normalized.includes("members.motorcycle_model") ||
    normalized.includes("members.motorcycle_color") ||
    normalized.includes("members.motorcycle_year") ||
    normalized.includes("members.motorcycle_plate") ||
    normalized.includes("members.prior_balance_due") ||
    normalized.includes("'birth_date' column of 'members'") ||
    normalized.includes('"birth_date" column of "members"') ||
    normalized.includes("'full_patch_since' column of 'members'") ||
    normalized.includes('"full_patch_since" column of "members"') ||
    normalized.includes("'dues_mandatory' column of 'members'") ||
    normalized.includes('"dues_mandatory" column of "members"') ||
    normalized.includes("'nickname' column of 'members'") ||
    normalized.includes('"nickname" column of "members"') ||
    normalized.includes("'motorcycle_brand' column of 'members'") ||
    normalized.includes('"motorcycle_brand" column of "members"') ||
    normalized.includes("'motorcycle_model' column of 'members'") ||
    normalized.includes('"motorcycle_model" column of "members"') ||
    normalized.includes("'motorcycle_color' column of 'members'") ||
    normalized.includes('"motorcycle_color" column of "members"') ||
    normalized.includes("'motorcycle_year' column of 'members'") ||
    normalized.includes('"motorcycle_year" column of "members"') ||
    normalized.includes("'motorcycle_plate' column of 'members'") ||
    normalized.includes('"motorcycle_plate" column of "members"') ||
    normalized.includes("'prior_balance_due' column of 'members'") ||
    normalized.includes('"prior_balance_due" column of "members"')
  );
}

function hasUnsupportedLegacyFieldValues(payload: Partial<MemberPayload>) {
  return Boolean(
    payload.nickname?.trim() ||
      payload.birth_date ||
    payload.full_patch_since ||
      payload.motorcycle_brand?.trim() ||
      payload.motorcycle_model?.trim() ||
      payload.motorcycle_color?.trim() ||
      payload.motorcycle_year ||
      payload.motorcycle_plate?.trim(),
  );
}

function getLegacySchemaSaveError() {
  return new Error(
    "Nickname, birthday, full patch date, and motorcycle fields cannot be saved yet because your live Supabase members table is missing those columns. Apply the latest members SQL migration first.",
  );
}

function mapLegacyDirectoryRow(
  row: Omit<
    MemberDirectoryRow,
    "nickname" | "birth_date" | "full_patch_since" | "dues_mandatory" | "prior_balance_due" | "archived_at" | "motorcycle_brand" | "motorcycle_model" | "motorcycle_color" | "motorcycle_year" | "motorcycle_plate"
  > & {
    archived_at?: string | null;
  },
): MemberDirectoryRow {
  return {
    ...row,
    nickname: null,
    birth_date: null,
    full_patch_since: null,
    dues_mandatory: true,
    prior_balance_due: 0,
    motorcycle_brand: null,
    motorcycle_model: null,
    motorcycle_color: null,
    motorcycle_year: null,
    motorcycle_plate: null,
    archived_at: row.archived_at ?? null,
  };
}

function mapLegacyMember(
  member: Omit<
    Member,
    "nickname" | "birth_date" | "full_patch_since" | "dues_mandatory" | "prior_balance_due" | "motorcycle_brand" | "motorcycle_model" | "motorcycle_color" | "motorcycle_year" | "motorcycle_plate"
  >,
): Member {
  return {
    ...member,
    nickname: null,
    birth_date: null,
    full_patch_since: null,
    dues_mandatory: true,
    prior_balance_due: 0,
    motorcycle_brand: null,
    motorcycle_model: null,
    motorcycle_color: null,
    motorcycle_year: null,
    motorcycle_plate: null,
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
  full_patch_since: string | null;
  motorcycle_brand: string | null;
  motorcycle_model: string | null;
  motorcycle_color: string | null;
  motorcycle_year: number | null;
  motorcycle_plate: string | null;
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
      mapLegacyDirectoryRow(
        row as Omit<
          MemberDirectoryRow,
          "nickname" | "birth_date" | "full_patch_since" | "dues_mandatory" | "prior_balance_due" | "archived_at" | "motorcycle_brand" | "motorcycle_model" | "motorcycle_color" | "motorcycle_year" | "motorcycle_plate"
        >,
      ),
    );
  }

  const rows = (data ?? []) as Omit<MemberDirectoryRow, "archived_at">[];
  return rows.map((row) => ({
    ...row,
    nickname: row.nickname ?? null,
    birth_date: row.birth_date ?? null,
    full_patch_since: row.full_patch_since ?? null,
    dues_mandatory: row.dues_mandatory ?? true,
    prior_balance_due: row.prior_balance_due ?? 0,
    motorcycle_brand: row.motorcycle_brand ?? null,
    motorcycle_model: row.motorcycle_model ?? null,
    motorcycle_color: row.motorcycle_color ?? null,
    motorcycle_year: row.motorcycle_year ?? null,
    motorcycle_plate: row.motorcycle_plate ?? null,
    archived_at: null,
  }));
}

export async function listMembersForAdmin(includeArchived: boolean): Promise<MemberDirectoryRow[]> {
  let query = supabase
    .from("members")
    .select("id, full_name, nickname, member_rank, active, dues_mandatory, city, state, photo_url, birth_date, date_joined, full_patch_since, archived_at, prior_balance_due, motorcycle_brand, motorcycle_model, motorcycle_color, motorcycle_year, motorcycle_plate")
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
        row as Omit<
          MemberDirectoryRow,
          "nickname" | "birth_date" | "full_patch_since" | "dues_mandatory" | "prior_balance_due" | "motorcycle_brand" | "motorcycle_model" | "motorcycle_color" | "motorcycle_year" | "motorcycle_plate"
        > & { archived_at?: string | null },
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
    return legacyData
      ? mapLegacyMember(
          legacyData as Omit<
            Member,
            "nickname" | "birth_date" | "full_patch_since" | "dues_mandatory" | "prior_balance_due" | "motorcycle_brand" | "motorcycle_model" | "motorcycle_color" | "motorcycle_year" | "motorcycle_plate"
          >,
        )
      : null;
  }

  return data as Member | null;
}

export async function createMemberByAdmin(payload: MemberPayload): Promise<string> {
  const { data, error } = await supabase.from("members").insert(payload).select("id").single();
  if (!error) return data.id as string;

  if (!isLegacyMemberColumnError(error.message)) {
    throw new Error(error.message);
  }

  if (hasUnsupportedLegacyFieldValues(payload)) {
    throw getLegacySchemaSaveError();
  }

  const {
    birth_date: _birthDate,
    full_patch_since: _fullPatchSince,
    nickname: _nickname,
    motorcycle_brand: _motorcycleBrand,
    motorcycle_model: _motorcycleModel,
    motorcycle_color: _motorcycleColor,
    motorcycle_year: _motorcycleYear,
    motorcycle_plate: _motorcyclePlate,
    ...legacyPayload
  } = payload;
  const { data: legacyData, error: legacyError } = await supabase.from("members").insert(legacyPayload).select("id").single();
  if (legacyError) throw new Error(legacyError.message);
  return legacyData.id as string;
}

export async function updateMemberByAdmin(memberId: string, payload: Partial<MemberPayload>): Promise<void> {
  const { error } = await supabase.from("members").update(payload).eq("id", memberId);
  if (!error) return;

  if (!isLegacyMemberColumnError(error.message)) {
    throw new Error(error.message);
  }

  if (hasUnsupportedLegacyFieldValues(payload)) {
    throw getLegacySchemaSaveError();
  }

  const {
    birth_date: _birthDate,
    full_patch_since: _fullPatchSince,
    nickname: _nickname,
    motorcycle_brand: _motorcycleBrand,
    motorcycle_model: _motorcycleModel,
    motorcycle_color: _motorcycleColor,
    motorcycle_year: _motorcycleYear,
    motorcycle_plate: _motorcyclePlate,
    ...legacyPayload
  } = payload;
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
