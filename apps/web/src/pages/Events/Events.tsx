import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Event } from "@treasure/shared";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
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
import { createEventByAdmin, deleteEventByAdmin, listEvents, updateEventByAdmin } from "../../services/eventService";
import { formatDateTime } from "../../utils/format";

interface EventFormState {
  event_name: string;
  description: string;
  location: string;
  address: string;
  starts_at: string;
  ends_at: string;
  event_type: string;
  attendance_requirement: Event["attendance_requirement"];
  notes: string;
  status: Event["status"];
}

const EMPTY_FORM: EventFormState = {
  event_name: "",
  description: "",
  location: "",
  address: "",
  starts_at: "",
  ends_at: "",
  event_type: "",
  attendance_requirement: "optional",
  notes: "",
  status: "scheduled",
};

function toNullable(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toInputDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function toUtcIso(value: string) {
  if (!value) return "";
  return new Date(value).toISOString();
}

function Events() {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<EventFormState>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [tab, setTab] = useState<"upcoming" | "past" | "all">("upcoming");

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listEvents();
      setEvents(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load events.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const filteredEvents = useMemo(() => {
    const now = Date.now();
    return events.filter((event) => {
      const starts = new Date(event.starts_at).getTime();
      if (tab === "upcoming") return starts >= now;
      if (tab === "past") return starts < now;
      return true;
    });
  }, [events, tab]);

  function openAddModal() {
    setFormState(EMPTY_FORM);
    setEditingId(null);
    setShowFormModal(true);
  }

  function openEditModal(event: Event) {
    setEditingId(event.id);
    setFormState({
      event_name: event.event_name,
      description: event.description ?? "",
      location: event.location ?? "",
      address: event.address ?? "",
      starts_at: toInputDateTime(event.starts_at),
      ends_at: event.ends_at ? toInputDateTime(event.ends_at) : "",
      event_type: event.event_type ?? "",
      attendance_requirement: event.attendance_requirement,
      notes: event.notes ?? "",
      status: event.status,
    });
    setShowFormModal(true);
  }

  function updateForm<K extends keyof EventFormState>(key: K, value: EventFormState[K]) {
    setFormState((prev) => ({ ...prev, [key]: value }));
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formState.event_name.trim() || !formState.starts_at) return;

    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        event_name: formState.event_name.trim(),
        description: toNullable(formState.description),
        location: toNullable(formState.location),
        address: toNullable(formState.address),
        starts_at: toUtcIso(formState.starts_at),
        ends_at: formState.ends_at ? toUtcIso(formState.ends_at) : null,
        event_type: toNullable(formState.event_type),
        organizer_member_id: null,
        attendance_requirement: formState.attendance_requirement,
        notes: toNullable(formState.notes),
        status: formState.status,
        created_by: null,
      };

      if (editingId) {
        await updateEventByAdmin(editingId, payload);
      } else {
        await createEventByAdmin(payload);
      }

      setShowFormModal(false);
      await loadEvents();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save event.");
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setIsSaving(true);

    try {
      await deleteEventByAdmin(deleteId);
      setDeleteId(null);
      await loadEvents();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete event.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="stack-xl">
      <PageHeader
        title="Events"
        subtitle="Chapter events and attendance"
        actions={
          isAdmin ? (
            <Button type="button" onClick={openAddModal}>
              Create Event
            </Button>
          ) : null
        }
      />

      <Card>
        <div className="tab-row">
          <Button type="button" variant={tab === "upcoming" ? "primary" : "secondary"} onClick={() => setTab("upcoming")}>
            Upcoming
          </Button>
          <Button type="button" variant={tab === "past" ? "primary" : "secondary"} onClick={() => setTab("past")}>
            Past
          </Button>
          <Button type="button" variant={tab === "all" ? "primary" : "secondary"} onClick={() => setTab("all")}>
            All
          </Button>
        </div>
      </Card>

      {isLoading ? <LoadingSpinner label="Loading events..." /> : null}
      {!isLoading && error ? <ErrorState message={error} onRetry={() => void loadEvents()} /> : null}

      {!isLoading && !error ? (
        filteredEvents.length === 0 ? (
          <EmptyState title="No events" description="There are no events for the selected filter." />
        ) : (
          <Card>
            <DataTable
              columns={
                <tr>
                  <th>Event</th>
                  <th>Type</th>
                  <th>Attendance</th>
                  <th>Status</th>
                  <th>When</th>
                  <th>Where</th>
                  {isAdmin ? <th>Actions</th> : null}
                </tr>
              }
            >
              {filteredEvents.map((eventRow) => (
                <tr key={eventRow.id}>
                  <td>
                    <div>
                      <strong>{eventRow.event_name}</strong>
                      {eventRow.description ? <p className="table-subtext">{eventRow.description}</p> : null}
                    </div>
                  </td>
                  <td>{eventRow.event_type ?? "-"}</td>
                  <td>
                    <Badge tone={eventRow.attendance_requirement === "required" ? "warning" : "info"}>
                      {eventRow.attendance_requirement}
                    </Badge>
                  </td>
                  <td>
                    <Badge tone={eventRow.status === "cancelled" ? "danger" : eventRow.status === "completed" ? "success" : "info"}>
                      {eventRow.status}
                    </Badge>
                  </td>
                  <td>{formatDateTime(eventRow.starts_at)}</td>
                  <td>{eventRow.location ?? eventRow.address ?? "-"}</td>
                  {isAdmin ? (
                    <td>
                      <div className="table-actions">
                        <Button type="button" size="sm" variant="ghost" onClick={() => openEditModal(eventRow)}>
                          Edit
                        </Button>
                        <Button type="button" size="sm" variant="danger" onClick={() => setDeleteId(eventRow.id)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </DataTable>
          </Card>
        )
      ) : null}

      <Modal
        open={showFormModal}
        title={editingId ? "Edit Event" : "Create Event"}
        onClose={() => setShowFormModal(false)}
      >
        <form className="stack-md" onSubmit={submitForm}>
          <div className="form-grid two-col">
            <div>
              <label className="field-label" htmlFor="event_name">
                Event Name
              </label>
              <Input
                id="event_name"
                value={formState.event_name}
                onChange={(event) => updateForm("event_name", event.target.value)}
                required
              />
            </div>
            <div>
              <label className="field-label" htmlFor="event_type">
                Event Type
              </label>
              <Input id="event_type" value={formState.event_type} onChange={(event) => updateForm("event_type", event.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="starts_at">
                Starts At
              </label>
              <Input
                id="starts_at"
                type="datetime-local"
                value={formState.starts_at}
                onChange={(event) => updateForm("starts_at", event.target.value)}
                required
              />
            </div>
            <div>
              <label className="field-label" htmlFor="ends_at">
                Ends At
              </label>
              <Input
                id="ends_at"
                type="datetime-local"
                value={formState.ends_at}
                onChange={(event) => updateForm("ends_at", event.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="location">
                Location
              </label>
              <Input id="location" value={formState.location} onChange={(event) => updateForm("location", event.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="address">
                Address
              </label>
              <Input id="address" value={formState.address} onChange={(event) => updateForm("address", event.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="attendance_requirement">
                Attendance
              </label>
              <Select
                id="attendance_requirement"
                value={formState.attendance_requirement}
                onChange={(event) => updateForm("attendance_requirement", event.target.value as Event["attendance_requirement"])}
              >
                <option value="optional">Optional</option>
                <option value="required">Required</option>
              </Select>
            </div>
            <div>
              <label className="field-label" htmlFor="status">
                Status
              </label>
              <Select
                id="status"
                value={formState.status}
                onChange={(event) => updateForm("status", event.target.value as Event["status"])}
              >
                <option value="scheduled">Scheduled</option>
                <option value="cancelled">Cancelled</option>
                <option value="completed">Completed</option>
              </Select>
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              rows={3}
              className="textarea"
              value={formState.description}
              onChange={(event) => updateForm("description", event.target.value)}
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
            <Button type="button" variant="secondary" onClick={() => setShowFormModal(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : editingId ? "Update Event" : "Create Event"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete Event"
        message="This event will be permanently removed. Continue?"
        confirmLabel="Delete"
        isPending={isSaving}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

export default Events;