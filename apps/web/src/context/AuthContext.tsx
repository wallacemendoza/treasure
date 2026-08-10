import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import type { Session } from "@supabase/supabase-js";
import type { AccessRole } from "../types/app";
import { supabase } from "../lib/supabase";
import { getProfileByUserId } from "../services/profileService";
import type { Profile } from "@treasure/shared";

interface AuthContextValue {
  isLoading: boolean;
  session: Session | null;
  profile: Profile | null;
  role: AccessRole | null;
  isAuthenticated: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getFriendlyAuthError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login")) {
    return "Invalid email or password.";
  }

  if (normalized.includes("invalid username/email or password")) {
    return "Invalid username/email or password.";
  }

  if (normalized.includes("failed to fetch") || normalized.includes("networkerror")) {
    return "Unable to reach login service. Check your connection and try again.";
  }

  if (normalized.includes("username-login") || normalized.includes("function") || normalized.includes("edge")) {
    return "Username login service is unavailable right now. Contact an admin to deploy the username-login function.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Your email is not confirmed yet. Check your inbox.";
  }

  return "Unable to sign in right now. Please try again.";
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    const profileData = await getProfileByUserId(userId);
    setProfile(profileData);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user.id) return;
    await loadProfile(session.user.id);
  }, [loadProfile, session?.user.id]);

  useEffect(() => {
    let mounted = true;

    async function bootstrapSession() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setSession(currentSession);

      if (currentSession?.user.id) {
        try {
          await loadProfile(currentSession.user.id);
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }

      if (mounted) {
        setIsLoading(false);
      }
    }

    bootstrapSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);

      if (nextSession?.user.id) {
        try {
          await loadProfile(nextSession.user.id);
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }

      setIsLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (identifier: string, password: string) => {
    const trimmedIdentifier = identifier.trim();

    if (!trimmedIdentifier || !password) {
      throw new Error("Email/username and password are required.");
    }

    if (trimmedIdentifier.includes("@")) {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedIdentifier,
        password,
      });

      if (error) {
        throw new Error(getFriendlyAuthError(error.message));
      }
      return;
    }

    const { data, error } = await supabase.functions.invoke("username-login", {
      body: {
        identifier: trimmedIdentifier,
        password,
      },
    });

    if (error) {
      throw new Error(getFriendlyAuthError(error.message));
    }

    const accessToken = data?.access_token;
    const refreshToken = data?.refresh_token;

    if (!accessToken || !refreshToken) {
      const functionMessage = typeof data?.error === "string" ? data.error : "Invalid username/email or password.";
      throw new Error(getFriendlyAuthError(functionMessage));
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (sessionError) {
      throw new Error(getFriendlyAuthError(sessionError.message));
    }
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error("Unable to sign out right now.");
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    return {
      isLoading,
      session,
      profile,
      role: profile?.access_role ?? null,
      isAuthenticated: Boolean(session),
      signIn,
      signOut,
      refreshProfile,
    };
  }, [isLoading, profile, refreshProfile, session, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
