"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import {
  getSupabaseBrowserClient,
  getCurrentUser,
  getCurrentSession,
} from "./supabase/client";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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
      setUser(session?.user ?? null);
      setSession(session);
      setLoading(false);

      if (event === "SIGNED_OUT") {
        router.push("/login");
      } else if (event === "SIGNED_IN") {
        router.push("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

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
