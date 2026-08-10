import { supabase } from "../lib/supabase";

export interface CreateUserPayload {
  username: string;
  email: string;
  password: string;
  access_role: "admin" | "viewer";
}

export async function createUserByAdmin(payload: CreateUserPayload): Promise<void> {
  const { data, error } = await supabase.functions.invoke("admin-create-user", {
    body: payload,
  });

  if (error) {
    // supabase-js surfaces non-2xx responses as a generic FunctionsHttpError;
    // the useful message is in the response body the function returned.
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const body = await context.clone().json();
        throw new Error(body.error ?? error.message);
      } catch {
        throw new Error(error.message);
      }
    }
    throw new Error(error.message);
  }

  if (data?.error) {
    throw new Error(data.error);
  }
}
