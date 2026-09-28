import type { DuesPayment, DuesStatus, LoanPayment, LoanStatus, TreasuryExpense, TreasuryLoan } from "@treasure/shared";
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

export async function listExpenses(): Promise<TreasuryExpense[]> {
  const { data, error } = await supabase
    .from("treasury_expenses")
    .select("*")
    .order("expense_date", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as TreasuryExpense[];
}

export interface ExpensePayload {
  expense_date: string;
  reason: string;
  amount: number;
  notes: string | null;
}

export async function createExpenseByAdmin(payload: ExpensePayload): Promise<void> {
  const { error } = await supabase.from("treasury_expenses").insert(payload);
  if (error) throw new Error(error.message);
}

export async function deleteExpenseByAdmin(expenseId: string): Promise<void> {
  const { error } = await supabase.from("treasury_expenses").delete().eq("id", expenseId);
  if (error) throw new Error(error.message);
}

export async function listLoans(): Promise<TreasuryLoan[]> {
  const { data, error } = await supabase
    .from("treasury_loans")
    .select("*")
    .order("loan_date", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as TreasuryLoan[];
}

export interface LoanPayload {
  member_id: string;
  reason: string;
  loan_date: string;
  amount: number;
  notes: string | null;
}

export async function createLoanByAdmin(payload: LoanPayload): Promise<void> {
  const { error } = await supabase.from("treasury_loans").insert(payload);
  if (error) throw new Error(error.message);
}

export async function setLoanStatusByAdmin(loanId: string, status: LoanStatus): Promise<void> {
  const { error } = await supabase
    .from("treasury_loans")
    .update({ status, repaid_at: status === "repaid" ? new Date().toISOString().slice(0, 10) : null })
    .eq("id", loanId);

  if (error) throw new Error(error.message);
}

export async function deleteLoanByAdmin(loanId: string): Promise<void> {
  const { error } = await supabase.from("treasury_loans").delete().eq("id", loanId);
  if (error) throw new Error(error.message);
}

export async function listLoanPayments(): Promise<LoanPayment[]> {
  const { data, error } = await supabase
    .from("treasury_loan_payments")
    .select("*")
    .order("payment_date", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as LoanPayment[];
}

export interface LoanPaymentPayload {
  loan_id: string;
  payment_date: string;
  amount: number;
  notes: string | null;
}

export async function createLoanPaymentByAdmin(payload: LoanPaymentPayload): Promise<void> {
  const { error } = await supabase.from("treasury_loan_payments").insert(payload);
  if (error) throw new Error(error.message);
}

export async function deleteLoanPaymentByAdmin(paymentId: string): Promise<void> {
  const { error } = await supabase.from("treasury_loan_payments").delete().eq("id", paymentId);
  if (error) throw new Error(error.message);
}
