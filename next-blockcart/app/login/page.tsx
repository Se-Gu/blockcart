"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { signIn, loading, user } = useAuth();
  const router = useRouter();

  // Check if user is authenticated but not in web_users table
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    // Check if user is authenticated but redirected here (likely not in web_users)
    const urlParams = new URLSearchParams(window.location.search);
    if (user && urlParams.get("access_denied") === "true") {
      setAccessDenied(true);
    } else if (user && !loading) {
      // User is authenticated and not loading, redirect to dashboard
      console.log("User already authenticated, redirecting to dashboard");
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    try {
      console.log("Login attempt:", email);
      await signIn(email, password);
      // Navigation is handled by the auth context onAuthStateChange
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "Invalid email or password");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Blockcart Admin</CardTitle>
          <CardDescription>
            {accessDenied
              ? "Access denied - Contact administrator"
              : "Sign in to access the dashboard"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accessDenied ? (
            <div className="space-y-4">
              <div className="rounded-md bg-destructive/15 p-4">
                <p className="text-sm text-destructive">
                  You are authenticated but don't have access to the admin
                  dashboard. Please contact your administrator to be added to
                  the system.
                </p>
              </div>
              <Button
                onClick={() => {
                  setAccessDenied(false);
                  window.history.replaceState({}, "", "/login");
                }}
                variant="outline"
                className="w-full"
              >
                Try Again
              </Button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@blockcart.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
