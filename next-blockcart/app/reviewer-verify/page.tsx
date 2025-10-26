"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function ReviewerVerifyContent() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const verifyToken = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        
        // Check if we already have a session (user already verified)
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (initialSession) {
          setTokenValid(true);
          setVerifying(false);
          return;
        }

        // Check if there's a hash fragment with auth tokens (PKCE flow)
        const hash = window.location.hash;
        
        if (hash && hash.includes('access_token')) {
          // Extract tokens from hash
          const accessTokenMatch = hash.match(/access_token=([^&]+)/);
          const refreshTokenMatch = hash.match(/refresh_token=([^&]+)/);
          
          if (accessTokenMatch) {
            try {
              // Set session using the tokens from hash
              const { data, error: setSessionError } = await supabase.auth.setSession({
                access_token: decodeURIComponent(accessTokenMatch[1]),
                refresh_token: refreshTokenMatch ? decodeURIComponent(refreshTokenMatch[1]) : '',
              });
              
              if (setSessionError) {
                throw setSessionError;
              }
              
              if (data.session) {
                setTokenValid(true);
                
                // Clear hash from URL
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
              } else {
                throw new Error("No session returned");
              }
            } catch (err) {
              console.error("Session setup error:", err);
              throw err;
            }
            return;
          }
        }

        // Try to get token from URL parameters (fallback for non-PKCE flows)
        const token = searchParams.get("token");
        const tokenHash = searchParams.get("token_hash");
        const type = searchParams.get("type") || "invite";

        if (tokenHash) {
          // Verify OTP with token hash
          const { error: otpError, data } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any,
          });

          if (otpError) {
            throw otpError;
          }

          if (data.session) {
            setTokenValid(true);
          } else {
            throw new Error("Session not established after verification");
          }
        } else if (token) {
          // Verify OTP with token
          const { error: otpError, data } = await supabase.auth.verifyOtp({
            token: token,
            type: type as any,
          });

          if (otpError) {
            throw otpError;
          }

          if (data.session) {
            setTokenValid(true);
          } else {
            throw new Error("Session not established after verification");
          }
        } else {
          setError("No verification token found in URL.");
        }
      } catch (err) {
        console.error("Verification error:", err);
        setError("Invalid or expired verification token. Please request a new invite.");
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        console.error("Password update error:", updateError);
        setError(updateError.message || "Failed to update password. Please try again.");
        setLoading(false);
        return;
      }

      // Success - redirect to dashboard
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Password update error:", err);
      setError(err.message || "An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Verifying invite...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Verification Failed</CardTitle>
            <CardDescription>
              Unable to verify your invite link
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error || "Invalid or expired verification token"}</AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground mt-4 text-center">
              Please contact your administrator to request a new invite.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set Your Password</CardTitle>
          <CardDescription>
            Choose a secure password to complete your reviewer account setup
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters long
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting password...
                </>
              ) : (
                "Set Password"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ReviewerVerifyPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <ReviewerVerifyContent />
    </Suspense>
  );
}
