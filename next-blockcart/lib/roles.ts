import type { User } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/types";

function normalizeRole(value: unknown): UserRole | null {
  if (!value) return null;

  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (normalized === "admin" || normalized === "reviewer") {
      return normalized;
    }
    return null;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const role = normalizeRole(entry);
      if (role) {
        return role;
      }
    }
  }

  return null;
}

export function isWebUser(user: User | null): boolean {
  if (!user) {
    return false;
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  return metadata.user_type === "web";
}

export function deriveUserRoleFromMetadata(user: User | null): UserRole {
  if (!user) {
    return "reviewer";
  }

  const appMetadata = (user.app_metadata ?? {}) as Record<string, unknown>;
  const userMetadata = (user.user_metadata ?? {}) as Record<string, unknown>;

  const roleFromAppMetadata =
    normalizeRole(appMetadata.role) ?? normalizeRole(appMetadata.roles);
  if (roleFromAppMetadata) {
    return roleFromAppMetadata;
  }

  const roleFromUserMetadata =
    normalizeRole(userMetadata.role) ?? normalizeRole(userMetadata.roles);
  if (roleFromUserMetadata) {
    return roleFromUserMetadata;
  }

  return "reviewer";
}

export function resolveRoleAndWebUser(
  user: User | null
): { isWebUser: boolean; role: UserRole } {
  const webUser = isWebUser(user);
  return {
    isWebUser: webUser,
    role: webUser ? deriveUserRoleFromMetadata(user) : "reviewer",
  };
}
