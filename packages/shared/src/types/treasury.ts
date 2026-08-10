export type DuesStatus = "paid" | "na" | "opt" | "out" | "unpaid";

export interface DuesPayment {
  id: string;
  member_id: string;
  year: number;
  month: number;
  status: DuesStatus;
  amount: number | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
