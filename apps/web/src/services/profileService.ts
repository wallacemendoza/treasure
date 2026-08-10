import type { Profile } from "@treasure/shared";
import { supabase } from "../lib/supabase";

export async function getProfileByUserId(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, access_role, login_enabled, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function listProfilesForAdmin(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, access_role, login_enabled, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateProfileAccessByAdmin(profile: Pick<Profile, "id" | "access_role" | "login_enabled" | "username">) {
  const { error } = await supabase
    .from("profiles")
    .update({
      username: profile.username,
      access_role: profile.access_role,
      login_enabled: profile.login_enabled,
    })
    .eq("id", profile.id);

  if (error) throw new Error(error.message);
}
