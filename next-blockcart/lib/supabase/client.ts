import { createBrowserClient } from "@supabase/ssr";
import type { User, Session } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/types";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (client) {
    return client;
  }

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return client;
}

// Auth helper functions
export async function signIn(email: string, password: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentSession(): Promise<Session | null> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

export async function getUserRole(userId: string): Promise<UserRole | null> {
  const supabase = getSupabaseBrowserClient();
  console.log("Fetching user role for userId:", userId);

  try {
    console.log("Starting database query...");

    // Add timeout to prevent hanging
    const queryPromise = supabase
      .from("web_users")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Query timeout after 5 seconds")), 5000)
    );

    const { data, error } = (await Promise.race([
      queryPromise,
      timeoutPromise,
    ])) as any;

    console.log("Database query completed. Data:", data, "Error:", error);

    if (error) {
      console.error("Error fetching user role from web_users:", error);
      throw error; // Re-throw to be handled by caller
    }

    if (!data) {
      console.log("User not found in web_users table");
      return null;
    }

    console.log("User role from database:", data.role);
    return (data.role as UserRole | undefined) ?? null;
  } catch (err) {
    console.error("Exception in getUserRole:", err);
    throw err;
  }
}
