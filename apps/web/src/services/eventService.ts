import type { Event } from "@treasure/shared";
import { supabase } from "../lib/supabase";

export async function listEvents() {
  const { data, error } = await supabase.from("events").select("*").order("starts_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Event[];
}

export async function createEventByAdmin(payload: Omit<Event, "id" | "created_at" | "updated_at">) {
  const { error } = await supabase.from("events").insert(payload);
  if (error) throw new Error(error.message);
}

export async function updateEventByAdmin(eventId: string, payload: Partial<Event>) {
  const { error } = await supabase.from("events").update(payload).eq("id", eventId);
  if (error) throw new Error(error.message);
}

export async function deleteEventByAdmin(eventId: string) {
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) throw new Error(error.message);
}
