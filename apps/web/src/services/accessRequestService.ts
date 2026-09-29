import { supabase } from "../lib/supabase";

export interface AccessRequest {
  id: string;
  full_name: string;
  username: string;
  email: string;
  status: "pending" | "approved" | "rejected";
  requested_at: string;
}

async function getFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: unknown }).context;
    if (context && typeof context === "object" && "json" in context && typeof context.json === "function") {
      try {
        const body = await context.json() as { error?: unknown; message?: unknown };
        if (typeof body.error === "string") return body.error;
        if (typeof body.message === "string") return body.message;
      } catch {
        return error instanceof Error ? error.message : fallback;
      }
    }
  }
  return error instanceof Error ? error.message : fallback;
}

export async function submitAccessRequest(payload: Pick<AccessRequest, "full_name" | "username" | "email">): Promise<void> {
  const { data, error } = await supabase.functions.invoke("request-access", { body: payload });
  if (error) throw new Error(await getFunctionErrorMessage(error, "Unable to send the access request."));
  if (data?.error) throw new Error(data.error);
}

export async function listPendingAccessRequests(): Promise<AccessRequest[]> {
  const { data, error } = await supabase
    .from("access_requests")
    .select("id, full_name, username, email, status, requested_at")
    .eq("status", "pending")
    .order("requested_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as AccessRequest[];
}

export async function reviewAccessRequest(
  requestId: string,
  action: "approve" | "reject",
  memberId?: string | null,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke("review-access-request", {
    body: { request_id: requestId, action, member_id: memberId ?? null },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
}
