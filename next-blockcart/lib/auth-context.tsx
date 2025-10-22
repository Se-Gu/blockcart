"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import {
  getSupabaseBrowserClient,
  getCurrentUser,
  getCurrentSession,
} from "./supabase/client";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/lib/types";
import { resolveRoleAndWebUser } from "@/lib/roles";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);
  const router = useRouter();

  const resolveUserRole = useCallback((currentUser: User | null, context = "unknown") => {
    if (!currentUser) {
      setUserRole(null);
      return;
    }

    const { isWebUser, role } = resolveRoleAndWebUser(currentUser);

    if (!isWebUser) {
      console.log(`User is not a web user (${context})`);
      setUserRole(null);
      return;
    }

    console.log(`Resolved user role from metadata (${context}):`, role);
    setUserRole(role);
  }, []);

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      try {
        const [userData, sessionData] = await Promise.all([
          getCurrentUser(),
          getCurrentSession(),
        ]);

        setUser(userData);
        setSession(sessionData);
        resolveUserRole(userData, "initial load");
        setHasInitialized(true);
      } catch (error) {
        console.error("Error getting session:", error);
        setHasInitialized(true);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    // Listen for auth changes
    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: string, session: Session | null) => {
      const currentUser = session?.user ?? null;
      console.log("Auth state changed:", event, currentUser?.email, "hasInitialized:", hasInitialized, "currentUser:", currentUser?.id);
      
      // Only process if we've initialized (completed initial session load)
      if (!hasInitialized) {
        console.log("Not yet initialized, skipping auth state change handler");
        return;
      }

      setLoading(true);
      setUser(currentUser);
      setSession(session);

      console.log("Resolving user role for:", currentUser?.id);
      resolveUserRole(currentUser, "auth state change");
      setLoading(false);

      if (event === "SIGNED_OUT") {
        console.log("User signed out, redirecting to login");
        router.push("/login");
      } else if (event === "SIGNED_IN" && currentUser) {
        // Don't redirect on SIGNED_IN event - let the page stay where it is
        // The user is already authenticated, they don't need to be sent to dashboard
        console.log("User signed in, but not redirecting (user is already authenticated)");
      }
    });

    return () => subscription.unsubscribe();
  }, [resolveUserRole, router, hasInitialized]);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { user: userData, session: sessionData } =
        await getSupabaseBrowserClient().auth.signInWithPassword({
          email,
          password,
        });

      if (userData && sessionData) {
        setUser(userData);
        setSession(sessionData);
        resolveUserRole(userData, "sign in");
        return;
      }

      // If Supabase did not throw but also did not return a user, reset loading state.
      setLoading(false);
    } catch (error) {
      console.error("Sign in error:", error);
      setLoading(false);
      throw error;
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await getSupabaseBrowserClient().auth.signOut();
      setUser(null);
      setSession(null);
      setUserRole(null);
    } catch (error) {
      console.error("Sign out error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    session,
    userRole,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
