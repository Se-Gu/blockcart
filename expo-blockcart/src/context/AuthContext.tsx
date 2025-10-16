import { createContext, useContext } from "react";
import type { Session } from "@supabase/supabase-js";

export type AuthContextValue = {
  session: Session | null;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined
);

export const useAuth = (): AuthContextValue => {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within an AuthContext provider");
  }
  return value;
};
