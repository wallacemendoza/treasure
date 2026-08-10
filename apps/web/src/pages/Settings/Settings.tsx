import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Profile } from "@treasure/shared";
import { Badge, Button, Card, DataTable, EmptyState, ErrorState, Input, LoadingSpinner, Modal, PageHeader, Select } from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import { listProfilesForAdmin, updateProfileAccessByAdmin } from "../../services/profileService";
import { createUserByAdmin } from "../../services/adminUserService";

interface NewUserForm {
  username: string;
  email: string;
  password: string;
  access_role: Profile["access_role"];
}

const EMPTY_NEW_USER: NewUserForm = {
  username: "",
  email: "",
  password: "",
  access_role: "viewer",
};

function Settings() {
  const { profile, role, refreshProfile } = useAuth();
  const isAdmin = role === "admin";

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState<NewUserForm>(EMPTY_NEW_USER);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const loadProfiles = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await listProfilesForAdmin();
      setProfiles(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load profiles.");
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  async function handleProfileUpdate(target: Profile, updates: Partial<Profile>) {
    try {
      setIsSaving(target.id);
      await updateProfileAccessByAdmin({
        id: target.id,
        username: updates.username ?? target.username,
        access_role: updates.access_role ?? target.access_role,
        login_enabled: updates.login_enabled ?? target.login_enabled,
      });

      await loadProfiles();
      if (profile?.id === target.id) {
        await refreshProfile();
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update profile.");
    } finally {
      setIsSaving(null);
    }
  }

  function updateNewUser<K extends keyof NewUserForm>(key: K, value: NewUserForm[K]) {
    setNewUser((prev) => ({ ...prev, [key]: value }));
  }

  function openCreateModal() {
    setNewUser(EMPTY_NEW_USER);
    setCreateError(null);
    setShowCreateModal(true);
  }

  async function submitCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);

    if (newUser.password.length < 8) {
      setCreateError("Password must be at least 8 characters.");
      return;
    }

    setIsCreating(true);
    try {
      await createUserByAdmin(newUser);
      setShowCreateModal(false);
      await loadProfiles();
    } catch (createErr) {
      setCreateError(createErr instanceof Error ? createErr.message : "Unable to create user.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="stack-xl">
      <PageHeader title="Settings" subtitle="Portal and access management" />

      <Card>
        <h2>My Account</h2>
        {!profile ? (
          <EmptyState title="Profile not found" description="Your profile row was not loaded from Supabase." />
        ) : (
          <div className="details-grid">
            <p>
              <strong>Username:</strong> {profile.username}
            </p>
            <p>
              <strong>Role:</strong> <Badge tone={profile.access_role === "admin" ? "warning" : "info"}>{profile.access_role}</Badge>
            </p>
            <p>
              <strong>Login Enabled:</strong>{" "}
              <Badge tone={profile.login_enabled ? "success" : "danger"}>{profile.login_enabled ? "Enabled" : "Disabled"}</Badge>
            </p>
          </div>
        )}
      </Card>

      {isAdmin ? (
        <Card>
          <div className="page-header" style={{ marginBottom: "var(--space-4)" }}>
            <h2>Administrative Access</h2>
            <Button type="button" onClick={openCreateModal}>
              + Create User
            </Button>
          </div>
          {isLoading ? <LoadingSpinner label="Loading profiles..." /> : null}
          {!isLoading && error ? <ErrorState message={error} onRetry={() => void loadProfiles()} /> : null}

          {!isLoading && !error ? (
            profiles.length === 0 ? (
              <EmptyState title="No profiles" description="No profile rows are available." />
            ) : (
              <DataTable
                columns={
                  <tr>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Login Enabled</th>
                  </tr>
                }
              >
                {profiles.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Input
                        value={row.username}
                        disabled={isSaving === row.id}
                        onChange={(event) => {
                          setProfiles((prev) =>
                            prev.map((item) => (item.id === row.id ? { ...item, username: event.target.value } : item)),
                          );
                        }}
                        onBlur={() => void handleProfileUpdate(row, { username: row.username })}
                      />
                    </td>
                    <td>
                      <Select
                        value={row.access_role}
                        disabled={isSaving === row.id}
                        onChange={(event) =>
                          void handleProfileUpdate(row, {
                            access_role: event.target.value as Profile["access_role"],
                          })
                        }
                      >
                        <option value="viewer">viewer</option>
                        <option value="admin">admin</option>
                      </Select>
                    </td>
                    <td>
                      <Button
                        type="button"
                        variant={row.login_enabled ? "secondary" : "danger"}
                        disabled={isSaving === row.id}
                        onClick={() =>
                          void handleProfileUpdate(row, {
                            login_enabled: !row.login_enabled,
                          })
                        }
                      >
                        {row.login_enabled ? "Enabled" : "Disabled"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </DataTable>
            )
          ) : null}
        </Card>
      ) : null}

      <Modal open={showCreateModal} title="Create User" onClose={() => setShowCreateModal(false)}>
        <form className="stack-md" onSubmit={submitCreateUser}>
          <div>
            <label className="field-label" htmlFor="new_username">
              Username
            </label>
            <Input
              id="new_username"
              value={newUser.username}
              onChange={(event) => updateNewUser("username", event.target.value)}
              required
            />
          </div>

          <div>
            <label className="field-label" htmlFor="new_email">
              Email
            </label>
            <Input
              id="new_email"
              type="email"
              value={newUser.email}
              onChange={(event) => updateNewUser("email", event.target.value)}
              required
            />
          </div>

          <div>
            <label className="field-label" htmlFor="new_password">
              Temporary Password
            </label>
            <Input
              id="new_password"
              type="text"
              value={newUser.password}
              onChange={(event) => updateNewUser("password", event.target.value)}
              placeholder="At least 8 characters"
              required
            />
            <p className="table-subtext" style={{ marginTop: "var(--space-1)" }}>
              Share this with the member directly — it isn't emailed automatically. They can sign in with
              either this username or their email.
            </p>
          </div>

          <div>
            <label className="field-label" htmlFor="new_access_role">
              Access Role
            </label>
            <Select
              id="new_access_role"
              value={newUser.access_role}
              onChange={(event) => updateNewUser("access_role", event.target.value as Profile["access_role"])}
            >
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </Select>
          </div>

          {createError ? <p className="form-error">{createError}</p> : null}

          <div className="modal-footer">
            <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? "Creating..." : "Create User"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Settings;