import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Member } from "@treasure/shared";
import {
  Avatar,
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
import {
  archiveMemberByAdmin,
  createMemberByAdmin,
  getMemberByIdForAdmin,
  listMembersDirectory,
  listMembersForAdmin,
  updateMemberByAdmin,
  type MemberPayload,
} from "../../services/memberService";
import type { MemberDirectoryRow } from "../../types/app";
import { cleanPhoneInput, formatDate, formatPhone } from "../../utils/format";

const RANK_OPTIONS: Member["member_rank"][] = ["support", "prospect", "full_patch"];
const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

interface FormState {
  full_name: string;
  email: string;
  phone: string;
  street_address: string;
  city: string;
  state: string;
  zip: string;
  photo_url: string;
  emergency_contact_name: string;
  emergency_contact_relationship: string;
  emergency_contact_phone: string;
  blood_type: string;
  member_rank: Member["member_rank"];
  active: boolean;
  date_joined: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  full_name: "",
  email: "",
  phone: "",
  street_address: "",
  city: "",
  state: "",
  zip: "",
  photo_url: "",
  emergency_contact_name: "",
  emergency_contact_relationship: "",
  emergency_contact_phone: "",
  blood_type: "",
  member_rank: "support",
  active: true,
  date_joined: "",
  notes: "",
};

function rankLabel(value: Member["member_rank"]) {
  if (value === "full_patch") return "Full Patch";
  if (value === "prospect") return "Prospect";
  return "Support";
}

function rankTone(value: Member["member_rank"]) {
  if (value === "full_patch") return "success" as const;
  if (value === "prospect") return "warning" as const;
  return "info" as const;
}

function toNullable(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapMemberToForm(member: Member): FormState {
  return {
    full_name: member.full_name,
    email: member.email ?? "",
    phone: member.phone ?? "",
    street_address: member.street_address ?? "",
    city: member.city ?? "",
    state: member.state ?? "",
    zip: member.zip ?? "",
    photo_url: member.photo_url ?? "",
    emergency_contact_name: member.emergency_contact_name ?? "",
    emergency_contact_relationship: member.emergency_contact_relationship ?? "",
    emergency_contact_phone: member.emergency_contact_phone ?? "",
    blood_type: member.blood_type ?? "",
    member_rank: member.member_rank,
    active: member.active,
    date_joined: member.date_joined ?? "",
    notes: member.notes ?? "",
  };
}

function formToPayload(form: FormState): MemberPayload {
  return {
    full_name: form.full_name.trim(),
    email: toNullable(form.email),
    phone: toNullable(form.phone),
    street_address: toNullable(form.street_address),
    city: toNullable(form.city),
    state: toNullable(form.state),
    zip: toNullable(form.zip),
    photo_url: toNullable(form.photo_url),
    emergency_contact_name: toNullable(form.emergency_contact_name),
    emergency_contact_relationship: toNullable(form.emergency_contact_relationship),
    emergency_contact_phone: toNullable(form.emergency_contact_phone),
    blood_type: toNullable(form.blood_type),
    member_rank: form.member_rank,
    active: form.active,
    date_joined: toNullable(form.date_joined),
    notes: toNullable(form.notes),
  };
}

function Members() {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [members, setMembers] = useState<MemberDirectoryRow[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const [search, setSearch] = useState("");
  const [rankFilter, setRankFilter] = useState<"all" | Member["member_rank"]>("all");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [archivedFilter, setArchivedFilter] = useState<"current" | "archived" | "all">("current");

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const [archiveMemberId, setArchiveMemberId] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const rows = isAdmin
        ? await listMembersForAdmin(archivedFilter !== "current")
        : await listMembersDirectory();
      setMembers(rows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load members.");
    } finally {
      setIsLoading(false);
    }
  }, [archivedFilter, isAdmin]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const filteredMembers = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    return members.filter((member) => {
      if (rankFilter !== "all" && member.member_rank !== rankFilter) return false;
      if (activeFilter === "active" && !member.active) return false;
      if (activeFilter === "inactive" && member.active) return false;
      if (isAdmin) {
        if (archivedFilter === "current" && member.archived_at) return false;
        if (archivedFilter === "archived" && !member.archived_at) return false;
      }

      if (!normalized) return true;

      const haystack = `${member.full_name} ${member.city ?? ""} ${member.state ?? ""} ${member.member_rank}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [activeFilter, archivedFilter, isAdmin, members, rankFilter, search]);

  function openAddModal() {
    setFormState(EMPTY_FORM);
    setEditingMemberId(null);
    setFormError(null);
    setShowFormModal(true);
  }

  async function openEditModal(memberId: string) {
    try {
      setIsSaving(true);
      setFormError(null);
      const member = await getMemberByIdForAdmin(memberId);
      if (!member) {
        setFormError("Member not found.");
        return;
      }
      setFormState(mapMemberToForm(member));
      setEditingMemberId(member.id);
      setShowFormModal(true);
    } catch (loadError) {
      setFormError(loadError instanceof Error ? loadError.message : "Unable to load member details.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleMemberClick(memberId: string) {
    if (!isAdmin) {
      setSelectedMember(null);
      return;
    }

    try {
      setIsSaving(true);
      const member = await getMemberByIdForAdmin(memberId);
      setSelectedMember(member);
    } catch {
      setSelectedMember(null);
    } finally {
      setIsSaving(false);
    }
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setFormState((prev) => ({ ...prev, [key]: value }));
  }

  function validateForm() {
    if (!formState.full_name.trim()) {
      return "Full name is required.";
    }

    if (formState.email && !/^\S+@\S+\.\S+$/.test(formState.email)) {
      return "Please enter a valid email address.";
    }

    return null;
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateForm();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const payload = formToPayload(formState);
      if (editingMemberId) {
        await updateMemberByAdmin(editingMemberId, payload);
      } else {
        await createMemberByAdmin(payload);
      }

      setShowFormModal(false);
      await loadMembers();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Unable to save member.");
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmArchive() {
    if (!archiveMemberId) return;

    try {
      setIsSaving(true);
      await archiveMemberByAdmin(archiveMemberId);
      setArchiveMemberId(null);
      await loadMembers();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Unable to archive member.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="stack-xl">
      <PageHeader
        title="Members"
        subtitle="Secure roster directory and administration"
        actions={
          isAdmin ? (
            <Button type="button" onClick={openAddModal}>
              Add Member
            </Button>
          ) : null
        }
      />

      <Card>
        <div className="filters-grid">
          <Input
            placeholder="Search by name, city, state, rank"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <Select value={rankFilter} onChange={(event) => setRankFilter(event.target.value as typeof rankFilter)}>
            <option value="all">All Ranks</option>
            {RANK_OPTIONS.map((rank) => (
              <option key={rank} value={rank}>
                {rankLabel(rank)}
              </option>
            ))}
          </Select>

          <Select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value as typeof activeFilter)}>
            <option value="all">All Active States</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </Select>

          {isAdmin ? (
            <Select value={archivedFilter} onChange={(event) => setArchivedFilter(event.target.value as typeof archivedFilter)}>
              <option value="current">Current Members</option>
              <option value="archived">Archived Members</option>
              <option value="all">All Members</option>
            </Select>
          ) : null}
        </div>
      </Card>

      {isLoading ? <LoadingSpinner label="Loading members..." /> : null}
      {!isLoading && error ? <ErrorState message={error} onRetry={() => void loadMembers()} /> : null}

      {!isLoading && !error ? (
        filteredMembers.length === 0 ? (
          <EmptyState title="No members found" description="Try adjusting your filters or search query." />
        ) : (
          <Card>
            <DataTable
              columns={
                <tr>
                  <th>Member</th>
                  <th>Rank</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Date Joined</th>
                  {isAdmin ? <th>Actions</th> : null}
                </tr>
              }
            >
              {filteredMembers.map((member) => (
                <tr key={member.id}>
                  <td>
                    <button type="button" className="table-member-cell" onClick={() => void handleMemberClick(member.id)}>
                      <Avatar name={member.full_name} src={member.photo_url} />
                      <span>{member.full_name}</span>
                    </button>
                  </td>
                  <td>
                    <Badge tone={rankTone(member.member_rank)}>{rankLabel(member.member_rank)}</Badge>
                  </td>
                  <td>
                    <Badge tone={member.active ? "success" : "warning"}>{member.active ? "Active" : "Inactive"}</Badge>
                  </td>
                  <td>{[member.city, member.state].filter(Boolean).join(", ") || "-"}</td>
                  <td>{formatDate(member.date_joined)}</td>
                  {isAdmin ? (
                    <td>
                      <div className="table-actions">
                        <Button type="button" size="sm" variant="ghost" onClick={() => void openEditModal(member.id)}>
                          Edit
                        </Button>
                        {!member.archived_at ? (
                          <Button type="button" size="sm" variant="danger" onClick={() => setArchiveMemberId(member.id)}>
                            Archive
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </DataTable>
          </Card>
        )
      ) : null}

      {isAdmin && selectedMember ? (
        <Card>
          <h2>Member Details</h2>
          <div className="details-grid">
            <p>
              <strong>Email:</strong> {selectedMember.email ?? "-"}
            </p>
            <p>
              <strong>Phone:</strong> {formatPhone(selectedMember.phone)}
            </p>
            <p>
              <strong>Address:</strong>{" "}
              {[selectedMember.street_address, selectedMember.city, selectedMember.state, selectedMember.zip]
                .filter(Boolean)
                .join(", ") || "-"}
            </p>
            <p>
              <strong>Emergency Contact:</strong> {selectedMember.emergency_contact_name ?? "-"}
            </p>
            <p>
              <strong>Emergency Relationship:</strong> {selectedMember.emergency_contact_relationship ?? "-"}
            </p>
            <p>
              <strong>Emergency Phone:</strong> {formatPhone(selectedMember.emergency_contact_phone)}
            </p>
            <p>
              <strong>Blood Type:</strong> {selectedMember.blood_type ?? "-"}
            </p>
            <p>
              <strong>Notes:</strong> {selectedMember.notes ?? "-"}
            </p>
          </div>
        </Card>
      ) : null}

      <Modal
        open={showFormModal}
        title={editingMemberId ? "Edit Member" : "Add Member"}
        onClose={() => setShowFormModal(false)}
      >
        <form className="stack-md" onSubmit={submitForm}>
          <div className="form-grid two-col">
            <div>
              <label className="field-label" htmlFor="full_name">
                Full Name
              </label>
              <Input
                id="full_name"
                value={formState.full_name}
                onChange={(event) => updateForm("full_name", event.target.value)}
                required
              />
            </div>

            <div>
              <label className="field-label" htmlFor="member_rank">
                Rank
              </label>
              <Select
                id="member_rank"
                value={formState.member_rank}
                onChange={(event) => updateForm("member_rank", event.target.value as Member["member_rank"])}
              >
                {RANK_OPTIONS.map((rank) => (
                  <option key={rank} value={rank}>
                    {rankLabel(rank)}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="field-label" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={formState.email}
                onChange={(event) => updateForm("email", event.target.value)}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="phone">
                Phone
              </label>
              <Input
                id="phone"
                value={formState.phone}
                onChange={(event) => updateForm("phone", cleanPhoneInput(event.target.value))}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="date_joined">
                Date Joined
              </label>
              <Input
                id="date_joined"
                type="date"
                value={formState.date_joined}
                onChange={(event) => updateForm("date_joined", event.target.value)}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="active">
                Active Status
              </label>
              <Select
                id="active"
                value={String(formState.active)}
                onChange={(event) => updateForm("active", event.target.value === "true")}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </Select>
            </div>

            <div>
              <label className="field-label" htmlFor="city">
                City
              </label>
              <Input id="city" value={formState.city} onChange={(event) => updateForm("city", event.target.value)} />
            </div>

            <div>
              <label className="field-label" htmlFor="state">
                State
              </label>
              <Input id="state" value={formState.state} onChange={(event) => updateForm("state", event.target.value)} />
            </div>

            <div>
              <label className="field-label" htmlFor="zip">
                ZIP
              </label>
              <Input id="zip" value={formState.zip} onChange={(event) => updateForm("zip", event.target.value)} />
            </div>

            <div>
              <label className="field-label" htmlFor="street_address">
                Street Address
              </label>
              <Input
                id="street_address"
                value={formState.street_address}
                onChange={(event) => updateForm("street_address", event.target.value)}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="blood_type">
                Blood Type
              </label>
              <Select
                id="blood_type"
                value={formState.blood_type}
                onChange={(event) => updateForm("blood_type", event.target.value)}
              >
                <option value="">Not Set</option>
                {BLOOD_TYPES.map((bloodType) => (
                  <option key={bloodType} value={bloodType}>
                    {bloodType}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="field-label" htmlFor="photo_url">
                Photo URL
              </label>
              <Input
                id="photo_url"
                value={formState.photo_url}
                onChange={(event) => updateForm("photo_url", event.target.value)}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="emergency_contact_name">
                Emergency Contact Name
              </label>
              <Input
                id="emergency_contact_name"
                value={formState.emergency_contact_name}
                onChange={(event) => updateForm("emergency_contact_name", event.target.value)}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="emergency_contact_relationship">
                Emergency Relationship
              </label>
              <Input
                id="emergency_contact_relationship"
                value={formState.emergency_contact_relationship}
                onChange={(event) => updateForm("emergency_contact_relationship", event.target.value)}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="emergency_contact_phone">
                Emergency Phone
              </label>
              <Input
                id="emergency_contact_phone"
                value={formState.emergency_contact_phone}
                onChange={(event) => updateForm("emergency_contact_phone", cleanPhoneInput(event.target.value))}
              />
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="notes">
              Notes
            </label>
            <textarea
              id="notes"
              className="textarea"
              rows={4}
              value={formState.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
            />
          </div>

          {formError ? <p className="form-error">{formError}</p> : null}

          <div className="modal-footer">
            <Button type="button" variant="secondary" onClick={() => setShowFormModal(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : editingMemberId ? "Update Member" : "Create Member"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(archiveMemberId)}
        title="Archive Member"
        message="This will archive the member and keep historical records. You can still view archived profiles from the filter."
        confirmLabel="Archive"
        isPending={isSaving}
        onCancel={() => setArchiveMemberId(null)}
        onConfirm={() => void confirmArchive()}
      />
    </div>
  );
}

export default Members;