import { supabase } from "../lib/supabase";

export interface CreateUserPayload {
  username: string;
  email: string;
  password: string;
  access_role: "admin" | "viewer";
  full_name: string;
  member_rank: "support" | "prospect" | "full_patch";
  create_member: boolean;
}

export async function createUserByAdmin(payload: CreateUserPayload): Promise<void> {
  const { data, error } = await supabase.functions.invoke("admin-create-user", {
    body: payload,
  });

  if (error) {
    // supabase-js may surface non-2xx responses as a generic message.
    // Try to recover the real edge-function payload from context.
    const context = (error as { context?: unknown }).context;

    if (context && typeof context === "object") {
      const maybeResponse = context as {
        status?: number;
        json?: () => Promise<unknown>;
        text?: () => Promise<string>;
      };

      if (typeof maybeResponse.json === "function") {
        try {
          const body = (await maybeResponse.json()) as { error?: string; message?: string };
          if (body?.error || body?.message) {
            throw new Error(body.error ?? body.message ?? error.message);
          }
        } catch {
          // Fall through to text parsing below.
        }
      }

      if (typeof maybeResponse.text === "function") {
        try {
          const raw = await maybeResponse.text();
          if (raw) {
            try {
              const parsed = JSON.parse(raw) as { error?: string; message?: string };
              if (parsed?.error || parsed?.message) {
                throw new Error(parsed.error ?? parsed.message ?? error.message);
              }
            } catch {
              throw new Error(raw);
            }
          }
        } catch {
          // Ignore and use mapped fallback.
        }
      }

      if (maybeResponse.status === 401 || maybeResponse.status === 403) {
        throw new Error("Your session is not authorized for this action. Sign out and sign in again, then retry.");
      }
    }

    const fallback = error.message || "Unable to create user.";
    if (fallback.includes("non-2xx") || fallback.includes("Edge Function")) {
      throw new Error("Unable to create user. Check if email/username already exists, then try again.");
    }

    throw new Error(fallback);
  }

  if (data?.error) {
    throw new Error(data.error);
  }
}
