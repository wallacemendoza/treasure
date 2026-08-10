import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { DuesPayment, DuesStatus } from "@treasure/shared";
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
  getMonthlyDuesAmount,
  listDuesPaymentsForYear,
  setMonthlyDuesAmountByAdmin,
  setPriorBalanceByAdmin,
  upsertDuesCellByAdmin,
} from "../../services/treasuryService";
import type { MemberDirectoryRow } from "../../types/app";

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
  return "\u2014";
}

interface EditingCell {
  memberId: string;
  memberName: string;
  month: number;
}

function Treasury() {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const [year, setYear] = useState(new Date().getFullYear());
  const [members, setMembers] = useState<MemberDirectoryRow[]>([]);
  const [duesAmount, setDuesAmount] = useState(30);
  const [payments, setPayments] = useState<DuesPayment[]>([]);
  const [priorBalances, setPriorBalances] = useState<Record<string, number>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [cellStatus, setCellStatus] = useState<DuesStatus>("paid");
  const [cellAmount, setCellAmount] = useState("");

  const [showDuesSettingModal, setShowDuesSettingModal] = useState(false);
  const [duesSettingInput, setDuesSettingInput] = useState("30");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [memberRows, amount, duesRows] = await Promise.all([
        isAdmin ? listMembersForAdmin(false) : listMembersDirectory(),
        getMonthlyDuesAmount(),
        listDuesPaymentsForYear(year),
      ]);
      setMembers(memberRows);
      setDuesAmount(amount);
      setPayments(duesRows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load treasury data.");
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, year]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const balances: Record<string, number> = {};
    for (const member of members) {
      balances[member.id] = member.prior_balance_due ?? 0;
    }
    setPriorBalances(balances);
  }, [members]);

  const paymentsByMember = useMemo(() => {
    const map = new Map<string, Map<number, DuesPayment>>();
    for (const payment of payments) {
      if (!map.has(payment.member_id)) map.set(payment.member_id, new Map());
      map.get(payment.member_id)!.set(payment.month, payment);
    }
    return map;
  }, [payments]);

  const activeMembers = useMemo(() => members.filter((m) => m.active && !m.archived_at), [members]);

  const summary = useMemo(() => {
    let outstandingYear = 0;
    let paidInFull = 0;

    for (const member of activeMembers) {
      const monthMap = paymentsByMember.get(member.id);
      let memberUnpaidMonths = 0;

      for (let month = 1; month <= 12; month += 1) {
        const status = monthMap?.get(month)?.status ?? "unpaid";
        if (status === "unpaid") memberUnpaidMonths += 1;
      }

      outstandingYear += memberUnpaidMonths * duesAmount;
      const prior = priorBalances[member.id] ?? 0;
      if (memberUnpaidMonths === 0 && prior === 0) paidInFull += 1;
    }

    const outstandingTotal =
      outstandingYear + activeMembers.reduce((sum, m) => sum + (priorBalances[m.id] ?? 0), 0);

    return {
      activeCount: activeMembers.length,
      outstandingYear,
      outstandingTotal,
      paidInFull,
    };
  }, [activeMembers, duesAmount, paymentsByMember, priorBalances]);

  function openCell(memberId: string, memberName: string, month: number) {
    if (!isAdmin) return;
    const existing = paymentsByMember.get(memberId)?.get(month);
    setEditingCell({ memberId, memberName, month });
    setCellStatus(existing?.status ?? "paid");
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

  async function submitPriorBalance(memberId: string, value: string) {
    const amount = Number(value);
    if (Number.isNaN(amount)) return;
    try {
      await setPriorBalanceByAdmin(memberId, amount);
      setPriorBalances((prev) => ({ ...prev, [memberId]: amount }));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update prior balance.");
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

  return (
    <div className="stack-xl">
      <PageHeader
        title="Treasury"
        subtitle={`Dues ledger · ${year} · $${duesAmount.toFixed(2)} / month`}
        actions={
          <div className="page-header-actions">
            <Select value={String(year)} onChange={(event) => setYear(Number(event.target.value))}>
              {[year - 1, year, year + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            {isAdmin ? (
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
            ) : null}
          </div>
        }
      />

      <Card>
        <div className="stats-grid">
          <div className="stat-card accent-neutral">
            <p className="stat-title">Active Members</p>
            <p className="stat-value">{summary.activeCount}</p>
          </div>
          <div className="stat-card accent-red">
            <p className="stat-title">Outstanding {year} Debt</p>
            <p className="stat-value">${summary.outstandingYear.toFixed(2)}</p>
          </div>
          <div className="stat-card accent-orange">
            <p className="stat-title">Outstanding Total Debt</p>
            <p className="stat-value">${summary.outstandingTotal.toFixed(2)}</p>
          </div>
          <div className="stat-card accent-green">
            <p className="stat-title">Paid In Full ({year})</p>
            <p className="stat-value">{summary.paidInFull}</p>
          </div>
        </div>
      </Card>

      {isLoading ? <LoadingSpinner label="Loading treasury data..." /> : null}
      {!isLoading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {!isLoading && !error ? (
        members.length === 0 ? (
          <EmptyState title="No members" description="Add members first, then track dues here." />
        ) : (
          <Card>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    {MONTHS.map((m) => (
                      <th key={m}>{m}</th>
                    ))}
                    <th>Prior Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => {
                    const monthMap = paymentsByMember.get(member.id);
                    return (
                      <tr key={member.id}>
                        <td>
                          <strong>{member.full_name}</strong>
                          {!member.active ? (
                            <span style={{ marginLeft: 6 }}>
                              <Badge tone="default">Inactive</Badge>
                            </span>
                          ) : null}
                        </td>
                        {MONTHS.map((_, idx) => {
                          const month = idx + 1;
                          const cell = monthMap?.get(month);
                          const status = cell?.status ?? "unpaid";
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
                          {isAdmin ? (
                            <Input
                              style={{ width: 96 }}
                              type="number"
                              step="0.01"
                              defaultValue={priorBalances[member.id] ?? 0}
                              onBlur={(event) => void submitPriorBalance(member.id, event.target.value)}
                            />
                          ) : (
                            <span>${(priorBalances[member.id] ?? 0).toFixed(2)}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
    </div>
  );
}

export default Treasury;
