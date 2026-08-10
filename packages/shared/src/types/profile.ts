import type { AccessRole } from "../constants/roles";

export interface Profile {
  id: string;
  username: string;
  access_role: AccessRole;
  login_enabled: boolean;
  created_at: string;
  updated_at: string;
}
