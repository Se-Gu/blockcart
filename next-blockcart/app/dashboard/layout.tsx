"use client";

import type React from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuth } from "@/lib/auth-context";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const ADMIN_ONLY_ROUTES = [
  "/dashboard/users",
  "/dashboard/campaigns",
  "/dashboard/rewards",
  "/dashboard/referrals",
  "/dashboard/analytics",
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, userRole, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    if (!userRole) {
      router.replace("/login");
      return;
    }

    const isAdminOnlyPath = ADMIN_ONLY_ROUTES.some((route) =>
      pathname.startsWith(route)
    );

    if (userRole === "reviewer" && isAdminOnlyPath) {
      router.replace("/dashboard");
    }
  }, [loading, pathname, router, user, userRole]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return null;
  }

  if (!userRole) {
    return null;
  }

  const isAdminOnlyPath = ADMIN_ONLY_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  if (userRole === "reviewer" && isAdminOnlyPath) {
    return null;
  }

  const userEmail = user.email || "";
  const userMetadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const userName =
    (typeof userMetadata.full_name === "string" && userMetadata.full_name) ||
    (typeof userMetadata.name === "string" && userMetadata.name) ||
    (typeof userMetadata.display_name === "string" && userMetadata.display_name) ||
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
