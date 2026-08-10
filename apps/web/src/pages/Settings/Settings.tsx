import { useCallback, useEffect, useState } from "react";
import type { Profile } from "@treasure/shared";
import { Badge, Button, Card, DataTable, EmptyState, ErrorState, Input, LoadingSpinner, PageHeader, Select } from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import { listProfilesForAdmin, updateProfileAccessByAdmin } from "../../services/profileService";

function Settings() {
  const { profile, role, refreshProfile } = useAuth();
  const isAdmin = role === "admin";

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="stack-xl">
      <PageHeader title="Settings" subtitle="Account and access control" />

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
          <h2>Administrative Access</h2>
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
    </div>
  );
}

export default Settings;