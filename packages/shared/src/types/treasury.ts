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

export interface TreasuryExpense {
  id: string;
  expense_date: string;
  reason: string;
  amount: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type LoanStatus = "outstanding" | "repaid";

export interface TreasuryLoan {
  id: string;
  member_id: string;
  reason: string;
  loan_date: string;
  amount: number;
  notes: string | null;
  status: LoanStatus;
  repaid_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoanPayment {
  id: string;
  loan_id: string;
  payment_date: string;
  amount: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}
