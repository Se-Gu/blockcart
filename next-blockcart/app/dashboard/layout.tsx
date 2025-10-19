"use client";

import type React from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuth } from "@/lib/auth-context";
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

  // For now, assume all authenticated users are admins
  // In production, you'd check user metadata or a user roles table
  const userRole = "admin" as const;
  const userEmail = user.email || "";

  return (
    <DashboardLayout userRole={userRole} userEmail={userEmail}>
      {children}
    </DashboardLayout>
  );
}
