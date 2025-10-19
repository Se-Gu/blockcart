"use client";

import type React from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuth } from "@/lib/auth-context";
import type { UserRole } from "@/lib/types";
import { deriveUserRoleFromMetadata } from "@/hooks/use-admin-guard";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return null;
  }

  const userRole = (user ? deriveUserRoleFromMetadata(user) : "admin") as UserRole;
  const userEmail = user.email || "";

  return (
    <DashboardLayout userRole={userRole} userEmail={userEmail}>
      {children}
    </DashboardLayout>
  );
}
