"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/lib/auth-context"
import { Loader2 } from "lucide-react"
import Image from "next/image"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const { signIn, loading, user } = useAuth()
  const router = useRouter()

  const [accessDenied, setAccessDenied] = useState(false)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    if (user && urlParams.get("access_denied") === "true") {
      setAccessDenied(true)
    } else if (user && !loading) {
      router.push("/dashboard")
    }
  }, [user, loading, router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!email || !password) {
      setError("Please fill in all fields")
      return
    }

    try {
      await signIn(email, password)
    } catch (err: any) {
      console.error("Login error:", err)
      setError(err.message || "Invalid email or password")
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-6">
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.1),rgba(255,255,255,0))]"
        aria-hidden
      />
      <Card className="relative w-full max-w-md border-border/60 shadow-2xl backdrop-blur-sm">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Image
              src="/favicon.png"
              alt="Blockcart"
              width={56}
              height={56}
              className="h-8 w-8 object-contain"
            />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">Blockcart Admin</CardTitle>
          <CardDescription className="text-base">
            {accessDenied ? "Access denied - Contact administrator" : "Sign in to access the dashboard"}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {accessDenied ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
                <p className="text-sm leading-relaxed text-destructive">
                  You are authenticated but don't have access to the admin dashboard. Please contact your administrator
                  to be added to the system.
                </p>
              </div>
              <Button
                onClick={() => {
                  setAccessDenied(false)
                  window.history.replaceState({}, "", "/login")
                }}
                variant="outline"
                className="w-full"
              >
                Try Again
              </Button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@blockcart.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
              {error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}
              <Button type="submit" className="h-11 w-full text-base font-medium" disabled={loading}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Signing in…</span>
                  </span>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
