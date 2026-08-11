import type { DuesPayment, DuesStatus } from "@treasure/shared";
import { supabase } from "../lib/supabase";

export async function getMonthlyDuesAmount(): Promise<number> {
  const { data, error } = await supabase
    .from("chapter_settings")
    .select("value")
    .eq("key", "monthly_dues_amount")
    .maybeSingle();

  if (error) throw new Error(error.message);
  const value = data?.value;
  return typeof value === "number" ? value : 30;
}

export async function setMonthlyDuesAmountByAdmin(amount: number): Promise<void> {
  const { error } = await supabase
    .from("chapter_settings")
    .update({ value: amount })
    .eq("key", "monthly_dues_amount");

  if (error) throw new Error(error.message);
}

export async function listDuesPaymentsForYear(year: number): Promise<DuesPayment[]> {
  const { data, error } = await supabase.from("dues_payments").select("*").eq("year", year);
  if (error) throw new Error(error.message);
  return (data ?? []) as DuesPayment[];
}

export interface DuesCellPayload {
  member_id: string;
  year: number;
  month: number;
  status: DuesStatus;
  amount: number | null;
}

export async function upsertDuesCellByAdmin(payload: DuesCellPayload): Promise<void> {
  const { error } = await supabase
    .from("dues_payments")
    .upsert(
      {
        ...payload,
        paid_at: payload.status === "paid" ? new Date().toISOString().slice(0, 10) : null,
      },
      { onConflict: "member_id,year,month" },
    );

  if (error) throw new Error(error.message);
}

export async function setPriorBalanceByAdmin(memberId: string, amount: number): Promise<void> {
  const { error } = await supabase.from("members").update({ prior_balance_due: amount }).eq("id", memberId);
  if (error) throw new Error(error.message);
}

export async function setDuesMandatoryByAdmin(memberId: string, duesMandatory: boolean): Promise<void> {
  const { error } = await supabase.from("members").update({ dues_mandatory: duesMandatory }).eq("id", memberId);
  if (error) throw new Error(error.message);
}

export async function getCurrentBalance(): Promise<number> {
  const { data, error } = await supabase
    .from("chapter_settings")
    .select("value")
    .eq("key", "current_balance")
    .maybeSingle();

  if (error) throw new Error(error.message);
  const value = data?.value;
  return typeof value === "number" ? value : 0;
}

export async function setCurrentBalanceByAdmin(amount: number): Promise<void> {
  const { error } = await supabase
    .from("chapter_settings")
    .upsert({ key: "current_balance", value: amount });

  if (error) throw new Error(error.message);
}
