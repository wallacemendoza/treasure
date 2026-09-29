import { supabase } from "../lib/supabase";

export interface AccessRequest {
  id: string;
  full_name: string;
  username: string;
  email: string;
  status: "pending" | "approved" | "rejected";
  requested_at: string;
}

export async function submitAccessRequest(payload: Pick<AccessRequest, "full_name" | "username" | "email">): Promise<void> {
  const { data, error } = await supabase.functions.invoke("request-access", { body: payload });
  if (error) throw new Error(error.message);
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
