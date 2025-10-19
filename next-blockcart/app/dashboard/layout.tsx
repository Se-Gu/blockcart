"use client";

import type React from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuth } from "@/lib/auth-context";
import type { UserRole } from "@/lib/types";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const ADMIN_ONLY_ROUTES = [
  "/dashboard/users",
  "/dashboard/campaigns",
  "/dashboard/rewards",
  "/dashboard/referrals",
  "/dashboard/analytics",
];

const REVIEWER_ONLY_ROUTES = ["/dashboard/receipts"];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, userRole, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  console.log(
    "Dashboard layout - user:",
    user?.email,
    "role:",
    userRole,
    "loading:",
    loading
  );

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    // Don't redirect if userRole is null - it might still be loading
    // The user is authenticated, so let them stay on the page
    if (userRole === null) {
      return;
    }

    const isAdminOnlyPath = ADMIN_ONLY_ROUTES.some((route) =>
      pathname.startsWith(route)
    );
    const isReviewerOnlyPath = REVIEWER_ONLY_ROUTES.some((route) =>
      pathname.startsWith(route)
    );

    if (userRole === "reviewer" && isAdminOnlyPath) {
      router.replace("/dashboard");
      return;
    }

    if (userRole === "admin" && isReviewerOnlyPath) {
      router.replace("/dashboard");
    }
  }, [loading, pathname, router, user, userRole]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return null;
  }

  // If userRole is null, redirect to login (user not in web_users table)
  if (userRole === null) {
    router.replace("/login");
    return null;
  }

  const isAdminOnlyPath = ADMIN_ONLY_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
  const isReviewerOnlyPath = REVIEWER_ONLY_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  if (userRole === "reviewer" && isAdminOnlyPath) {
    return null;
  }

  if (userRole === "admin" && isReviewerOnlyPath) {
    return null;
  }

  const userEmail = user.email || "";
  const userMetadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const userName =
    (typeof userMetadata.full_name === "string" && userMetadata.full_name) ||
    (typeof userMetadata.name === "string" && userMetadata.name) ||
    (typeof userMetadata.display_name === "string" &&
      userMetadata.display_name) ||
    userEmail;

  return (
    <DashboardLayout
      userRole={userRole}
      userEmail={userEmail}
      userName={userName}
    >
      {children}
    </DashboardLayout>
  );
}
