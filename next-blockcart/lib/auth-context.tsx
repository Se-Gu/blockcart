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
  getUserRole,
} from "./supabase/client";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/lib/types";

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
  const [roleFetching, setRoleFetching] = useState(false);
  const router = useRouter();

  const resolveUserRole = useCallback(
    async (currentUser: User | null, context = "unknown") => {
      if (!currentUser) {
        setUserRole(null);
        return;
      }

      // Prevent duplicate role fetches
      if (roleFetching) {
        console.log(`Role fetch already in progress, skipping (${context})`);
        return;
      }

      // If we already have a valid role for this user, don't fetch again
      if (userRole && user?.id === currentUser.id) {
        console.log(
          `Already have role ${userRole} for user ${currentUser.id}, skipping fetch (${context})`
        );
        return;
      }

      setRoleFetching(true);
      const metadataRole =
        (currentUser.user_metadata?.role as UserRole | undefined) ?? null;

      try {
        console.log(
          `Starting getUserRole for user ${currentUser.id} (${context})`
        );
        const dbRole = await getUserRole(currentUser.id);
        console.log(
          `getUserRole completed with result: ${dbRole} (${context})`
        );

        if (dbRole === null) {
          // User not found in web_users table
          console.log(`User not found in web_users table (${context})`);
          setUserRole(null);
          return;
        }
        const finalRole = dbRole ?? metadataRole ?? "reviewer";
        console.log(`Resolved user role (${context}):`, finalRole);
        setUserRole(finalRole);
      } catch (roleError) {
        console.error(`Error fetching user role (${context}):`, roleError);
        // If there's an error, set role to null to trigger redirect
        setUserRole(null);
      } finally {
        setRoleFetching(false);
      }
    },
    [roleFetching, userRole, user?.id]
  );

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
        await resolveUserRole(userData, "initial load");
      } catch (error) {
        console.error("Error getting session:", error);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    // Listen for auth changes
    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event, session?.user?.email);
      setLoading(true);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setSession(session);

      console.log("Resolving user role for:", currentUser?.id);
      await resolveUserRole(currentUser, "auth state change");
      setLoading(false);

      if (event === "SIGNED_OUT") {
        console.log("User signed out, redirecting to login");
        router.push("/login");
      } else if (event === "SIGNED_IN" && currentUser) {
        console.log("User signed in successfully, redirecting to dashboard");
        router.push("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [resolveUserRole, router]);

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
        await resolveUserRole(userData, "sign in");
      }
    } catch (error) {
      console.error("Sign in error:", error);
      throw error;
    } finally {
      setLoading(false);
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
