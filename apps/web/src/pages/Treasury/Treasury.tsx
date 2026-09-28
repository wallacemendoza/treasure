import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { DuesPayment, DuesStatus, TreasuryExpense, TreasuryLoan } from "@treasure/shared";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingSpinner,
  Modal,
  PageHeader,
  Select,
} from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import { listMembersDirectory, listMembersForAdmin } from "../../services/memberService";
import {
  createExpenseByAdmin,
  createLoanByAdmin,
  deleteExpenseByAdmin,
  deleteLoanByAdmin,
  getCurrentBalance,
  getMonthlyDuesAmount,
  listDuesPaymentsForYear,
  listExpenses,
  listLoans,
  setCurrentBalanceByAdmin,
  setDuesMandatoryByAdmin,
  setLoanStatusByAdmin,
  setMonthlyDuesAmountByAdmin,
  setPriorBalanceByAdmin,
  upsertDuesCellByAdmin,
} from "../../services/treasuryService";
import type { MemberDirectoryRow } from "../../types/app";
import { getYearsSinceDate } from "../../utils/format";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function statusTone(status: DuesStatus) {
  if (status === "paid") return "danger" as const; // crimson pill, matches the club ledger's red PAID cells
  if (status === "opt") return "success" as const;
  if (status === "na") return "default" as const;
  if (status === "out") return "default" as const;
  return "default" as const;
}

function statusLabel(status: DuesStatus, amount: number | null) {
  if (status === "paid") return amount != null ? `$${amount.toFixed(2)}` : "PAID";
  if (status === "na") return "N/A";
  if (status === "opt") return "OPT";
  if (status === "out") return "OUT";
  return "DUE";
}

interface EditingCell {
  memberId: string;
  memberName: string;
  month: number;
}

function Treasury() {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const year = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [members, setMembers] = useState<MemberDirectoryRow[]>([]);
  const [duesAmount, setDuesAmount] = useState(30);
  const [payments, setPayments] = useState<DuesPayment[]>([]);
  const [priorBalances, setPriorBalances] = useState<Record<string, number>>({});
  const [priorBalanceDrafts, setPriorBalanceDrafts] = useState<Record<string, string>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [cellStatus, setCellStatus] = useState<DuesStatus>("paid");
  const [cellAmount, setCellAmount] = useState("");

  const [showDuesSettingModal, setShowDuesSettingModal] = useState(false);
  const [duesSettingInput, setDuesSettingInput] = useState("30");

  const [currentBalance, setCurrentBalance] = useState(0);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [balanceInput, setBalanceInput] = useState("0");

  const [expenses, setExpenses] = useState<TreasuryExpense[]>([]);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseDateInput, setExpenseDateInput] = useState(() => new Date().toISOString().slice(0, 10));
  const [expenseReasonInput, setExpenseReasonInput] = useState("");
  const [expenseAmountInput, setExpenseAmountInput] = useState("");
  const [expenseNotesInput, setExpenseNotesInput] = useState("");

  const [loans, setLoans] = useState<TreasuryLoan[]>([]);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [loanMemberIdInput, setLoanMemberIdInput] = useState("");
  const [loanDateInput, setLoanDateInput] = useState(() => new Date().toISOString().slice(0, 10));
  const [loanReasonInput, setLoanReasonInput] = useState("");
  const [loanAmountInput, setLoanAmountInput] = useState("");
  const [loanNotesInput, setLoanNotesInput] = useState("");

  const [memberDebtDetail, setMemberDebtDetail] = useState<MemberDirectoryRow | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [memberRows, amount, duesRows, balance, expenseRows, loanRows] = await Promise.all([
        isAdmin ? listMembersForAdmin(false) : listMembersDirectory(),
        getMonthlyDuesAmount(),
        listDuesPaymentsForYear(year),
        getCurrentBalance(),
        listExpenses(),
        listLoans(),
      ]);
      setMembers(memberRows);
      setDuesAmount(amount);
      setPayments(duesRows);
      setCurrentBalance(balance);
      setExpenses(expenseRows);
      setLoans(loanRows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load treasury data.");
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const balances: Record<string, number> = {};
    const drafts: Record<string, string> = {};
    for (const member of members) {
      balances[member.id] = member.prior_balance_due ?? 0;
      drafts[member.id] = String(member.prior_balance_due ?? 0);
    }
    setPriorBalances(balances);
    setPriorBalanceDrafts(drafts);
  }, [members]);

  const paymentsByMember = useMemo(() => {
    const map = new Map<string, Map<number, DuesPayment>>();
    for (const payment of payments) {
      if (!map.has(payment.member_id)) map.set(payment.member_id, new Map());
      map.get(payment.member_id)!.set(payment.month, payment);
    }
    return map;
  }, [payments]);

  const loansByMember = useMemo(() => {
    const map = new Map<string, number>();
    for (const loan of loans) {
      if (loan.status !== "outstanding") continue;
      map.set(loan.member_id, (map.get(loan.member_id) ?? 0) + loan.amount);
    }
    return map;
  }, [loans]);

  const activeMembers = useMemo(() => members.filter((m) => m.active && !m.archived_at), [members]);

  const ledgerMembers = useMemo(() => members.filter((m) => !m.archived_at), [members]);

  const sortedLedgerMembers = useMemo(() => {
    return [...ledgerMembers].sort((a, b) => {
      const aYears = getYearsSinceDate(a.full_patch_since);
      const bYears = getYearsSinceDate(b.full_patch_since);

      // Longest full-patch tenure first.
      if (aYears !== null && bYears !== null && aYears !== bYears) {
        return bYears - aYears;
      }
      if (aYears !== null && bYears === null) return -1;
      if (aYears === null && bYears !== null) return 1;

      return a.full_name.localeCompare(b.full_name);
    });
  }, [ledgerMembers]);

  function getMemberMonthStatus(member: MemberDirectoryRow, month: number): DuesStatus {
    const existing = paymentsByMember.get(member.id)?.get(month)?.status;
    if (existing) return existing;
    return member.dues_mandatory ? "unpaid" : "opt";
  }

  const summary = useMemo(() => {
    let outstandingYear = 0;
    let paidInFull = 0;
    let mandatoryMembers = 0;

    for (const member of activeMembers) {
      if (member.dues_mandatory) mandatoryMembers += 1;
      const monthMap = paymentsByMember.get(member.id);
      let memberUnpaidMonths = 0;

      for (let month = 1; month <= currentMonth; month += 1) {
        const status = monthMap?.get(month)?.status ?? (member.dues_mandatory ? "unpaid" : "opt");
        if (status === "unpaid") memberUnpaidMonths += 1;
      }

      if (member.dues_mandatory) {
        outstandingYear += memberUnpaidMonths * duesAmount;
      }
      const prior = priorBalances[member.id] ?? 0;
      if (member.dues_mandatory && memberUnpaidMonths === 0 && prior === 0) paidInFull += 1;
    }

    const outstandingTotal =
      outstandingYear +
      activeMembers.reduce((sum, m) => sum + (priorBalances[m.id] ?? 0), 0) +
      activeMembers.reduce((sum, m) => sum + (loansByMember.get(m.id) ?? 0), 0);

    return {
      activeCount: activeMembers.length,
      mandatoryMembers,
      optionalMembers: Math.max(activeMembers.length - mandatoryMembers, 0),
      outstandingYear,
      outstandingTotal,
      paidInFull,
    };
  }, [activeMembers, currentMonth, duesAmount, loansByMember, paymentsByMember, priorBalances]);

  const monthlyBreakdown = useMemo(() => {
    return MONTHS.map((label, idx) => {
      const month = idx + 1;
      let collected = 0;
      let expected = 0;
      let paidCount = 0;
      let unpaidCount = 0;

      for (const member of activeMembers) {
        if (!member.dues_mandatory) continue;
        expected += duesAmount;
        const cell = paymentsByMember.get(member.id)?.get(month);
        const status = cell?.status ?? "unpaid";
        if (status === "paid") {
          collected += cell?.amount ?? duesAmount;
          paidCount += 1;
        } else if (status === "unpaid") {
          unpaidCount += 1;
        }
      }

      const rate = expected > 0 ? Math.round((collected / expected) * 100) : 0;
      return { label, month, collected, expected, rate, paidCount, unpaidCount };
    });
  }, [activeMembers, paymentsByMember, duesAmount]);

  const dashboardStats = useMemo(() => {
    let collectedThisYear = 0;
    const expectedToDate = summary.mandatoryMembers * currentMonth * duesAmount;

    for (const month of monthlyBreakdown) {
      collectedThisYear += month.collected;
    }

    const collectionRate = expectedToDate > 0 ? Math.min(100, Math.round((collectedThisYear / expectedToDate) * 100)) : 0;
    return { collectedThisYear, expectedToDate, collectionRate };
  }, [summary.mandatoryMembers, currentMonth, duesAmount, monthlyBreakdown]);

  const topDebtors = useMemo(() => {
    return activeMembers
      .map((member) => {
        const monthMap = paymentsByMember.get(member.id);
        let unpaidMonths = 0;
        if (member.dues_mandatory) {
          for (let month = 1; month <= currentMonth; month += 1) {
            const status = monthMap?.get(month)?.status ?? "unpaid";
            if (status === "unpaid") unpaidMonths += 1;
          }
        }
        const prior = priorBalances[member.id] ?? 0;
        const loanOwed = loansByMember.get(member.id) ?? 0;
        const totalOwed = unpaidMonths * duesAmount + prior + loanOwed;
        return { ...member, unpaidMonths, totalOwed, prior, loanOwed };
      })
      .filter((m) => m.totalOwed > 0)
      .sort((a, b) => b.totalOwed - a.totalOwed)
      .slice(0, 6);
  }, [activeMembers, currentMonth, paymentsByMember, duesAmount, priorBalances, loansByMember]);

  function openCell(memberId: string, memberName: string, month: number) {
    if (!isAdmin) return;
    const existing = paymentsByMember.get(memberId)?.get(month);
    setEditingCell({ memberId, memberName, month });
    const member = members.find((row) => row.id === memberId);
    setCellStatus(existing?.status ?? (member?.dues_mandatory ? "paid" : "opt"));
    setCellAmount(existing?.amount != null ? String(existing.amount) : String(duesAmount));
  }

  async function submitCell(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCell) return;
    setIsSaving(true);
    setError(null);

    try {
      await upsertDuesCellByAdmin({
        member_id: editingCell.memberId,
        year,
        month: editingCell.month,
        status: cellStatus,
        amount: cellStatus === "paid" ? Number(cellAmount) || duesAmount : null,
      });
      setEditingCell(null);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save that cell.");
    } finally {
      setIsSaving(false);
    }
  }

  async function submitPriorBalance(memberId: string) {
    const rawValue = priorBalanceDrafts[memberId] ?? "";
    const amount = Number.parseFloat(rawValue);
    if (Number.isNaN(amount)) {
      setError("Prior balance must be a valid number.");
      return;
    }

    try {
      await setPriorBalanceByAdmin(memberId, amount);
      setPriorBalances((prev) => ({ ...prev, [memberId]: amount }));
      setMembers((prev) => prev.map((member) => (member.id === memberId ? { ...member, prior_balance_due: amount } : member)));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update prior balance.");
    }
  }

  async function submitBalance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(balanceInput);
    if (Number.isNaN(amount)) return;
    setIsSaving(true);
    try {
      await setCurrentBalanceByAdmin(amount);
      setCurrentBalance(amount);
      setShowBalanceModal(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update treasury balance.");
    } finally {
      setIsSaving(false);
    }
  }

  async function submitDuesSetting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(duesSettingInput);
    if (Number.isNaN(amount) || amount <= 0) return;
    setIsSaving(true);
    try {
      await setMonthlyDuesAmountByAdmin(amount);
      setDuesAmount(amount);
      setShowDuesSettingModal(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update dues amount.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDuesMandatoryChange(memberId: string, isMandatory: boolean) {
    if (!isAdmin) return;
    try {
      await setDuesMandatoryByAdmin(memberId, isMandatory);
      setMembers((prev) => prev.map((member) => (member.id === memberId ? { ...member, dues_mandatory: isMandatory } : member)));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update mandatory dues setting.");
    }
  }

  const totalExpenses = useMemo(() => expenses.reduce((sum, expense) => sum + expense.amount, 0), [expenses]);

  function openExpenseModal() {
    setExpenseDateInput(new Date().toISOString().slice(0, 10));
    setExpenseReasonInput("");
    setExpenseAmountInput("");
    setExpenseNotesInput("");
    setShowExpenseModal(true);
  }

  async function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(expenseAmountInput);
    if (!expenseReasonInput.trim() || Number.isNaN(amount) || amount < 0) return;
    setIsSaving(true);
    try {
      await createExpenseByAdmin({
        expense_date: expenseDateInput,
        reason: expenseReasonInput.trim(),
        amount,
        notes: expenseNotesInput.trim() || null,
      });
      setShowExpenseModal(false);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save that expense.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteExpense(expenseId: string) {
    if (!isAdmin) return;
    try {
      await deleteExpenseByAdmin(expenseId);
      setExpenses((prev) => prev.filter((expense) => expense.id !== expenseId));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to delete that expense.");
    }
  }

  const outstandingLoanTotal = useMemo(
    () => loans.filter((loan) => loan.status === "outstanding").reduce((sum, loan) => sum + loan.amount, 0),
    [loans],
  );

  function memberLabel(memberId: string) {
    const member = members.find((row) => row.id === memberId);
    if (!member) return "Unknown member";
    return member.nickname?.trim() || member.full_name;
  }

  function openLoanModal() {
    setLoanMemberIdInput(sortedLedgerMembers[0]?.id ?? "");
    setLoanDateInput(new Date().toISOString().slice(0, 10));
    setLoanReasonInput("");
    setLoanAmountInput("");
    setLoanNotesInput("");
    setShowLoanModal(true);
  }

  async function submitLoan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(loanAmountInput);
    if (!loanMemberIdInput || !loanReasonInput.trim() || Number.isNaN(amount) || amount < 0) return;
    setIsSaving(true);
    try {
      await createLoanByAdmin({
        member_id: loanMemberIdInput,
        reason: loanReasonInput.trim(),
        loan_date: loanDateInput,
        amount,
        notes: loanNotesInput.trim() || null,
      });
      setShowLoanModal(false);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save that loan.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleLoanStatus(loan: TreasuryLoan) {
    if (!isAdmin) return;
    const nextStatus = loan.status === "outstanding" ? "repaid" : "outstanding";
    try {
      await setLoanStatusByAdmin(loan.id, nextStatus);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update that loan.");
    }
  }

  async function handleDeleteLoan(loanId: string) {
    if (!isAdmin) return;
    try {
      await deleteLoanByAdmin(loanId);
      setLoans((prev) => prev.filter((loan) => loan.id !== loanId));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to delete that loan.");
    }
  }

  return (
    <div className="stack-xl">
      <div className="treasury-balance-hero">
        <div>
          <p className="treasury-balance-label">Current Treasury Balance</p>
          <p className="treasury-balance-amount">${currentBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        {isAdmin ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setBalanceInput(String(currentBalance));
              setShowBalanceModal(true);
            }}
          >
            Edit Balance
          </Button>
        ) : null}
      </div>

      <PageHeader
        title="Treasury Ledger"
        subtitle={`${year} · $${duesAmount.toFixed(2)} / member / month`}
        actions={
          isAdmin ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDuesSettingInput(String(duesAmount));
                setShowDuesSettingModal(true);
              }}
            >
              Set Dues Amount
            </Button>
          ) : null
        }
      />

      {/* ── Dashboard ── */}
      <div className="treas-dash-stats">
        <div className="treas-stat-card treas-stat-collected">
          <p className="treas-stat-label">Collected {year}</p>
          <p className="treas-stat-value">${dashboardStats.collectedThisYear.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="treas-stat-card treas-stat-expected">
          <p className="treas-stat-label">Expected to Date</p>
          <p className="treas-stat-value">${dashboardStats.expectedToDate.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="treas-stat-card treas-stat-outstanding">
          <p className="treas-stat-label">Outstanding Total</p>
          <p className="treas-stat-value treas-danger">${summary.outstandingTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="treas-stat-card treas-stat-rate">
          <p className="treas-stat-label">Collection Rate</p>
          <div className="treas-rate-wrap">
            <p className="treas-stat-value treas-rate-pct">{dashboardStats.collectionRate}%</p>
            <div className="treas-rate-bar-bg">
              <div className="treas-rate-bar-fill" style={{ width: `${dashboardStats.collectionRate}%` }} />
            </div>
          </div>
        </div>
        <div className="treas-stat-card treas-stat-pif">
          <p className="treas-stat-label">Paid in Full</p>
          <p className="treas-stat-value">{summary.paidInFull} <span className="treas-stat-of">/ {summary.mandatoryMembers}</span></p>
        </div>
      </div>

      <div className="treas-dash-lower">
        <Card className="treas-monthly-card">
          <p className="treasury-summary-label">Monthly Collection — {year}</p>
          <div className="treas-month-list">
            {monthlyBreakdown.map(({ label, month, collected, rate, paidCount, unpaidCount }) => {
              const isFuture = month > currentMonth;
              return (
                <div key={month} className={`treas-month-row${month === currentMonth ? " treas-month-current" : ""}${isFuture ? " treas-month-future" : ""}`}>
                  <span className="treas-month-label">{label}</span>
                  <div className="treas-month-bar-wrap">
                    <div className="treas-month-bar-bg">
                      <div className="treas-month-bar-fill" style={{ width: isFuture ? "0%" : `${rate}%` }} />
                    </div>
                  </div>
                  <span className="treas-month-pct">{isFuture ? "—" : `${rate}%`}</span>
                  <span className="treas-month-amt">
                    {isFuture ? "" : `$${collected.toFixed(0)}`}
                  </span>
                  <span className="treas-month-counts">
                    {isFuture ? "" : (
                      <>
                        <span className="treas-paid-pill">{paidCount} paid</span>
                        {unpaidCount > 0 ? <span className="treas-unpaid-pill">{unpaidCount} due</span> : null}
                      </>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="treas-attention-card">
          <p className="treasury-summary-label">Needs Attention</p>
          {topDebtors.length === 0 ? (
            <div className="treas-all-clear">
              <span className="treas-all-clear-icon">✓</span>
              <p>All mandatory members are current</p>
            </div>
          ) : (
            <ul className="treas-debtor-list">
              {topDebtors.map((member) => (
                <li key={member.id} className="treas-debtor-row">
                  <div className="treas-debtor-info">
                    <span className="treas-debtor-name">{member.nickname?.trim() || member.full_name}</span>
                    <span className="treas-debtor-detail">
                      {member.unpaidMonths > 0 ? `${member.unpaidMonths} mo unpaid` : ""}
                      {member.prior > 0 ? `${member.unpaidMonths > 0 ? " · " : ""}prior $${member.prior.toFixed(0)}` : ""}
                      {member.loanOwed > 0
                        ? `${member.unpaidMonths > 0 || member.prior > 0 ? " · " : ""}loan $${member.loanOwed.toFixed(0)}`
                        : ""}
                    </span>
                  </div>
                  <span className="treas-debtor-amount">${member.totalOwed.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <div className="treasury-table-header">
          <h2>Expense Log</h2>
          <p className="treasury-table-sub">Track chapter spending — date, reason, and amount.</p>
        </div>
        {isAdmin ? (
          <div style={{ marginBottom: 16 }}>
            <Button type="button" onClick={openExpenseModal}>
              Add Expense
            </Button>
          </div>
        ) : null}
        {expenses.length === 0 ? (
          <EmptyState title="No expenses logged" description="Recorded expenses will show up here." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reason</th>
                  <th>Notes</th>
                  <th>Amount</th>
                  {isAdmin ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>{expense.expense_date}</td>
                    <td>{expense.reason}</td>
                    <td>{expense.notes ?? ""}</td>
                    <td>${expense.amount.toFixed(2)}</td>
                    {isAdmin ? (
                      <td>
                        <Button type="button" variant="secondary" onClick={() => void handleDeleteExpense(expense.id)}>
                          Delete
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>
                    <strong>Total</strong>
                  </td>
                  <td>
                    <strong>${totalExpenses.toFixed(2)}</strong>
                  </td>
                  {isAdmin ? <td /> : null}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <div className="treasury-table-header">
          <h2>Loans</h2>
          <p className="treasury-table-sub">
            Money lent to a member — reason, date, amount, and who's responsible for paying it back. Outstanding
            loans count toward that member's total owed.
          </p>
        </div>
        {isAdmin ? (
          <div style={{ marginBottom: 16 }}>
            <Button type="button" onClick={openLoanModal}>
              Add Loan
            </Button>
          </div>
        ) : null}
        {loans.length === 0 ? (
          <EmptyState title="No loans logged" description="Recorded loans will show up here." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Member</th>
                  <th>Reason</th>
                  <th>Notes</th>
                  <th>Amount</th>
                  <th>Status</th>
                  {isAdmin ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => (
                  <tr key={loan.id}>
                    <td>{loan.loan_date}</td>
                    <td>{memberLabel(loan.member_id)}</td>
                    <td>{loan.reason}</td>
                    <td>{loan.notes ?? ""}</td>
                    <td>${loan.amount.toFixed(2)}</td>
                    <td>
                      <Badge tone={loan.status === "outstanding" ? "danger" : "success"}>
                        {loan.status === "outstanding" ? "Outstanding" : "Repaid"}
                      </Badge>
                    </td>
                    {isAdmin ? (
                      <td style={{ display: "flex", gap: 8 }}>
                        <Button type="button" variant="secondary" onClick={() => void handleToggleLoanStatus(loan)}>
                          {loan.status === "outstanding" ? "Mark Repaid" : "Mark Outstanding"}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => void handleDeleteLoan(loan.id)}>
                          Delete
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>
                    <strong>Outstanding Total</strong>
                  </td>
                  <td>
                    <strong>${outstandingLoanTotal.toFixed(2)}</strong>
                  </td>
                  <td />
                  {isAdmin ? <td /> : null}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {isLoading ? <LoadingSpinner label="Loading treasury data..." /> : null}
      {!isLoading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {!isLoading && !error ? (
        sortedLedgerMembers.length === 0 ? (
          <EmptyState title="No members" description="Add members first, then track dues here." />
        ) : (
          <Card>
            <div className="treasury-table-header">
              <h2>Monthly Contributions - {year}</h2>
              <p className="treasury-table-sub">
                Every current member is listed automatically. Set a member to optional when they are not required to pay.
              </p>
            </div>
            <div className="table-wrap">
              <table className="data-table treasury-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Member</th>
                    {MONTHS.map((m) => (
                      <th key={m}>{m}</th>
                    ))}
                    <th>{year} Debt</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLedgerMembers.map((member, rowIndex) => {
                    const monthMap = paymentsByMember.get(member.id);
                    let yearlyDebt = 0;
                    for (let month = 1; month <= currentMonth; month += 1) {
                      const status = getMemberMonthStatus(member, month);
                      if (status === "unpaid" && member.dues_mandatory) yearlyDebt += duesAmount;
                    }
                    return (
                      <tr key={member.id}>
                        <td>{rowIndex + 1}</td>
                        <td>
                          <button
                            type="button"
                            className="treas-member-btn"
                            onClick={() => setMemberDebtDetail(member)}
                          >
                            <strong>{member.nickname?.trim() || member.full_name}</strong>
                            {!member.active ? (
                              <Badge tone="default">Inactive</Badge>
                            ) : null}
                          </button>
                        </td>
                        {MONTHS.map((_, idx) => {
                          const month = idx + 1;
                          const cell = monthMap?.get(month);
                          const status = getMemberMonthStatus(member, month);
                          return (
                            <td key={month}>
                              <button
                                type="button"
                                className="btn btn-sm btn-ghost"
                                disabled={!isAdmin}
                                onClick={() => openCell(member.id, member.full_name, month)}
                                style={{ cursor: isAdmin ? "pointer" : "default" }}
                              >
                                <Badge tone={statusTone(status)}>{statusLabel(status, cell?.amount ?? null)}</Badge>
                              </button>
                            </td>
                          );
                        })}
                        <td>
                          <strong>${yearlyDebt.toFixed(2)}</strong>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="table-subtext" style={{ marginTop: 12 }}>
              Legend: PAID = payment recorded, DUE = mandatory and unpaid, OPT = optional contribution, N/A = not applicable, OUT = out.
            </p>
          </Card>
        )
      ) : null}

      <Modal
        open={Boolean(editingCell)}
        title={editingCell ? `${editingCell.memberName} \u2014 ${MONTHS[editingCell.month - 1]} ${year}` : ""}
        onClose={() => setEditingCell(null)}
      >
        <form className="stack-md" onSubmit={submitCell}>
          <div>
            <label className="field-label" htmlFor="cell_status">
              Status
            </label>
            <Select id="cell_status" value={cellStatus} onChange={(event) => setCellStatus(event.target.value as DuesStatus)}>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="na">N/A (not applicable)</option>
              <option value="opt">Optional contribution</option>
              <option value="out">Out (left the club)</option>
            </Select>
          </div>

          {cellStatus === "paid" ? (
            <div>
              <label className="field-label" htmlFor="cell_amount">
                Amount
              </label>
              <Input
                id="cell_amount"
                type="number"
                step="0.01"
                value={cellAmount}
                onChange={(event) => setCellAmount(event.target.value)}
              />
            </div>
          ) : null}

          <div className="modal-footer">
            <Button type="button" variant="secondary" onClick={() => setEditingCell(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={showBalanceModal} title="Update Treasury Balance" onClose={() => setShowBalanceModal(false)}>
        <form className="stack-md" onSubmit={submitBalance}>
          <div>
            <label className="field-label" htmlFor="treasury_balance">
              Current Balance (USD)
            </label>
            <Input
              id="treasury_balance"
              type="number"
              step="0.01"
              value={balanceInput}
              onChange={(event) => setBalanceInput(event.target.value)}
              required
            />
          </div>
          <div className="modal-footer">
            <Button type="button" variant="secondary" onClick={() => setShowBalanceModal(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={showDuesSettingModal} title="Monthly Dues Amount" onClose={() => setShowDuesSettingModal(false)}>
        <form className="stack-md" onSubmit={submitDuesSetting}>
          <div>
            <label className="field-label" htmlFor="dues_amount">
              Amount (USD / month)
            </label>
            <Input
              id="dues_amount"
              type="number"
              step="0.01"
              value={duesSettingInput}
              onChange={(event) => setDuesSettingInput(event.target.value)}
              required
            />
          </div>
          <div className="modal-footer">
            <Button type="button" variant="secondary" onClick={() => setShowDuesSettingModal(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={showExpenseModal} title="Add Expense" onClose={() => setShowExpenseModal(false)}>
        <form className="stack-md" onSubmit={submitExpense}>
          <div>
            <label className="field-label" htmlFor="expense_date">
              Date
            </label>
            <Input
              id="expense_date"
              type="date"
              value={expenseDateInput}
              onChange={(event) => setExpenseDateInput(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor="expense_reason">
              Reason
            </label>
            <Input
              id="expense_reason"
              type="text"
              value={expenseReasonInput}
              onChange={(event) => setExpenseReasonInput(event.target.value)}
              placeholder="e.g. Chapter meeting supplies"
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor="expense_amount">
              Amount
            </label>
            <Input
              id="expense_amount"
              type="number"
              step="0.01"
              min="0"
              value={expenseAmountInput}
              onChange={(event) => setExpenseAmountInput(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor="expense_notes">
              Notes (optional)
            </label>
            <Input
              id="expense_notes"
              type="text"
              value={expenseNotesInput}
              onChange={(event) => setExpenseNotesInput(event.target.value)}
            />
          </div>
          <div className="modal-footer">
            <Button type="button" variant="secondary" onClick={() => setShowExpenseModal(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={showLoanModal} title="Add Loan" onClose={() => setShowLoanModal(false)}>
        <form className="stack-md" onSubmit={submitLoan}>
          <div>
            <label className="field-label" htmlFor="loan_member">
              Responsible Member
            </label>
            <Select id="loan_member" value={loanMemberIdInput} onChange={(event) => setLoanMemberIdInput(event.target.value)} required>
              <option value="" disabled>
                Select a member
              </option>
              {sortedLedgerMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.nickname?.trim() || member.full_name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="field-label" htmlFor="loan_date">
              Date
            </label>
            <Input
              id="loan_date"
              type="date"
              value={loanDateInput}
              onChange={(event) => setLoanDateInput(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor="loan_reason">
              Reason
            </label>
            <Input
              id="loan_reason"
              type="text"
              value={loanReasonInput}
              onChange={(event) => setLoanReasonInput(event.target.value)}
              placeholder="e.g. Emergency bike repair"
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor="loan_amount">
              Amount
            </label>
            <Input
              id="loan_amount"
              type="number"
              step="0.01"
              min="0"
              value={loanAmountInput}
              onChange={(event) => setLoanAmountInput(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor="loan_notes">
              Notes (optional)
            </label>
            <Input
              id="loan_notes"
              type="text"
              value={loanNotesInput}
              onChange={(event) => setLoanNotesInput(event.target.value)}
            />
          </div>
          <div className="modal-footer">
            <Button type="button" variant="secondary" onClick={() => setShowLoanModal(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Member debt detail modal */}
      <Modal
        open={Boolean(memberDebtDetail)}
        title={memberDebtDetail ? (memberDebtDetail.nickname?.trim() || memberDebtDetail.full_name) : ""}
        onClose={() => setMemberDebtDetail(null)}
      >
        {memberDebtDetail ? (() => {
          const monthMap = paymentsByMember.get(memberDebtDetail.id);
          let debt2026 = 0;
          for (let month = 1; month <= currentMonth; month += 1) {
            const status = monthMap?.get(month)?.status ?? (memberDebtDetail.dues_mandatory ? "unpaid" : "opt");
            if (status === "unpaid" && memberDebtDetail.dues_mandatory) debt2026 += duesAmount;
          }
          const priorDebt = priorBalances[memberDebtDetail.id] ?? 0;
          const loanDebt = loansByMember.get(memberDebtDetail.id) ?? 0;
          const totalDebt = debt2026 + priorDebt + loanDebt;

          return (
            <div className="treas-detail-modal">
              <p className="treas-detail-fullname">{memberDebtDetail.full_name}</p>
              <div className="treas-detail-grid">
                <div className="treas-detail-stat">
                  <p className="treas-detail-label">{year} Debt</p>
                  <p className={`treas-detail-value${debt2026 > 0 ? " treas-danger" : " treas-ok"}`}>${debt2026.toFixed(2)}</p>
                </div>
                <div className="treas-detail-stat">
                  <p className="treas-detail-label">Prior Balance</p>
                  <p className={`treas-detail-value${priorDebt > 0 ? " treas-danger" : " treas-ok"}`}>${priorDebt.toFixed(2)}</p>
                </div>
                <div className="treas-detail-stat">
                  <p className="treas-detail-label">Loans Owed</p>
                  <p className={`treas-detail-value${loanDebt > 0 ? " treas-danger" : " treas-ok"}`}>${loanDebt.toFixed(2)}</p>
                </div>
                <div className="treas-detail-stat treas-detail-total">
                  <p className="treas-detail-label">Total Owed</p>
                  <p className={`treas-detail-value treas-detail-big${totalDebt > 0 ? " treas-danger" : " treas-ok"}`}>${totalDebt.toFixed(2)}</p>
                </div>
              </div>

              {isAdmin ? (
                <div className="treas-detail-admin stack-md" style={{ marginTop: 24 }}>
                  <div>
                    <label className="field-label">Dues Status</label>
                    <Select
                      value={memberDebtDetail.dues_mandatory ? "mandatory" : "optional"}
                      onChange={(event) => {
                        const isMandatory = event.target.value === "mandatory";
                        void handleDuesMandatoryChange(memberDebtDetail.id, isMandatory);
                        setMemberDebtDetail({ ...memberDebtDetail, dues_mandatory: isMandatory });
                      }}
                    >
                      <option value="mandatory">Mandatory</option>
                      <option value="optional">Optional</option>
                    </Select>
                  </div>
                  <div>
                    <label className="field-label">Prior Balance (USD)</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Input
                        type="number"
                        step="0.01"
                        value={priorBalanceDrafts[memberDebtDetail.id] ?? "0"}
                        onChange={(event) =>
                          setPriorBalanceDrafts((prev) => ({ ...prev, [memberDebtDetail.id]: event.target.value }))
                        }
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void submitPriorBalance(memberDebtDetail.id)}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })() : null}
      </Modal>
    </div>
  );
}

export default Treasury;
