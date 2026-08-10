import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { MemberStatusRecord } from "@treasure/shared";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  LoadingSpinner,
  Modal,
  PageHeader,
  Select,
} from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import { createStatusRecordByAdmin, listStatusRecords, updateStatusRecordByAdmin } from "../../services/disciplineService";
import { formatDate } from "../../utils/format";

interface FormState {
  member_id: string;
  type: MemberStatusRecord["type"];
  reason: string;
  start_date: string;
  expected_end_date: string;
  actual_end_date: string;
  duration_preset: Exclude<MemberStatusRecord["duration_preset"], null>;
  status: MemberStatusRecord["status"];
  notes: string;
}

const EMPTY_FORM: FormState = {
  member_id: "",
  type: "suspension",
  reason: "",
  start_date: new Date().toISOString().slice(0, 10),
  expected_end_date: "",
  actual_end_date: "",
  duration_preset: "custom",
  status: "active",
  notes: "",
};

function toNullable(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toneForStatus(status: MemberStatusRecord["status"]) {
  if (status === "active") return "warning" as const;
  if (status === "ended") return "success" as const;
  return "danger" as const;
}

function Discipline() {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const [records, setRecords] = useState<MemberStatusRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(EMPTY_FORM);

  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listStatusRecords();
      setRecords(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load records.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  function openAdd() {
    setEditingId(null);
    setFormState(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(record: MemberStatusRecord) {
    setEditingId(record.id);
    setFormState({
      member_id: record.member_id,
      type: record.type,
      reason: record.reason ?? "",
      start_date: record.start_date,
      expected_end_date: record.expected_end_date ?? "",
      actual_end_date: record.actual_end_date ?? "",
      duration_preset: record.duration_preset ?? "custom",
      status: record.status,
      notes: record.notes ?? "",
    });
    setShowModal(true);
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setFormState((prev) => ({ ...prev, [key]: value }));
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formState.member_id.trim()) return;

    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        member_id: formState.member_id.trim(),
        type: formState.type,
        reason: toNullable(formState.reason),
        start_date: formState.start_date,
        expected_end_date: toNullable(formState.expected_end_date),
        actual_end_date: toNullable(formState.actual_end_date),
        duration_preset: formState.duration_preset,
        status: formState.status,
        notes: toNullable(formState.notes),
      };

      if (editingId) {
        await updateStatusRecordByAdmin(editingId, payload);
      } else {
        await createStatusRecordByAdmin(payload);
      }

      setShowModal(false);
      await loadRecords();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save record.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="stack-xl">
      <PageHeader
        title="Discipline"
        subtitle="Status records and discipline history"
        actions={
          isAdmin ? (
            <Button type="button" onClick={openAdd}>
              Add Record
            </Button>
          ) : null
        }
      />

      {isLoading ? <LoadingSpinner label="Loading records..." /> : null}
      {!isLoading && error ? <ErrorState message={error} onRetry={() => void loadRecords()} /> : null}

      {!isLoading && !error ? (
        records.length === 0 ? (
          <EmptyState title="No status records" description="No discipline records are available for your role." />
        ) : (
          <Card>
            <DataTable
              columns={
                <tr>
                  <th>Member ID</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Start</th>
                  <th>Expected End</th>
                  <th>Actual End</th>
                  {isAdmin ? <th>Actions</th> : null}
                </tr>
              }
            >
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{record.member_id}</td>
                  <td>{record.type.replace(/_/g, " ")}</td>
                  <td>
                    <Badge tone={toneForStatus(record.status)}>{record.status}</Badge>
                  </td>
                  <td>{formatDate(record.start_date)}</td>
                  <td>{formatDate(record.expected_end_date)}</td>
                  <td>{formatDate(record.actual_end_date)}</td>
                  {isAdmin ? (
                    <td>
                      <Button type="button" size="sm" variant="ghost" onClick={() => openEdit(record)}>
                        Edit
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </DataTable>
          </Card>
        )
      ) : null}

      <Modal
        open={showModal}
        title={editingId ? "Update Status Record" : "Add Status Record"}
        onClose={() => setShowModal(false)}
      >
        <form className="stack-md" onSubmit={submitForm}>
          <div className="form-grid two-col">
            <div>
              <label className="field-label" htmlFor="member_id">
                Member ID
              </label>
              <Input
                id="member_id"
                value={formState.member_id}
                onChange={(event) => updateForm("member_id", event.target.value)}
                required
              />
            </div>
            <div>
              <label className="field-label" htmlFor="type">
                Type
              </label>
              <Select
                id="type"
                value={formState.type}
                onChange={(event) => updateForm("type", event.target.value as MemberStatusRecord["type"])}
              >
                <option value="suspension">Suspension</option>
                <option value="leave">Leave</option>
                <option value="probation">Probation</option>
                <option value="temporary_restriction">Temporary Restriction</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <div>
              <label className="field-label" htmlFor="start_date">
                Start Date
              </label>
              <Input
                id="start_date"
                type="date"
                value={formState.start_date}
                onChange={(event) => updateForm("start_date", event.target.value)}
                required
              />
            </div>
            <div>
              <label className="field-label" htmlFor="expected_end_date">
                Expected End Date
              </label>
              <Input
                id="expected_end_date"
                type="date"
                value={formState.expected_end_date}
                onChange={(event) => updateForm("expected_end_date", event.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="actual_end_date">
                Actual End Date
              </label>
              <Input
                id="actual_end_date"
                type="date"
                value={formState.actual_end_date}
                onChange={(event) => updateForm("actual_end_date", event.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="duration_preset">
                Duration Preset
              </label>
              <Select
                id="duration_preset"
                value={formState.duration_preset}
                onChange={(event) => updateForm("duration_preset", event.target.value as FormState["duration_preset"])}
              >
                <option value="30_days">30 days</option>
                <option value="60_days">60 days</option>
                <option value="90_days">90 days</option>
                <option value="6_months">6 months</option>
                <option value="1_year">1 year</option>
                <option value="indefinite">Indefinite</option>
                <option value="custom">Custom</option>
              </Select>
            </div>
            <div>
              <label className="field-label" htmlFor="status">
                Status
              </label>
              <Select
                id="status"
                value={formState.status}
                onChange={(event) => updateForm("status", event.target.value as MemberStatusRecord["status"])}
              >
                <option value="active">Active</option>
                <option value="ended">Ended</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="reason">
              Reason
            </label>
            <textarea
              id="reason"
              rows={3}
              className="textarea"
              value={formState.reason}
              onChange={(event) => updateForm("reason", event.target.value)}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="notes">
              Notes
            </label>
            <textarea
              id="notes"
              rows={3}
              className="textarea"
              value={formState.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
            />
          </div>

          <div className="modal-footer">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : editingId ? "Update Record" : "Create Record"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Discipline;