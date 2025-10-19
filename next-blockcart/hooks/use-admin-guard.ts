"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"

import type { UserRole } from "@/lib/types"
import { useAuth } from "@/lib/auth-context"

function normalizeRole(value: unknown): UserRole | null {
  if (!value) return null
  if (typeof value === "string") {
    const normalized = value.toLowerCase()
    if (normalized === "admin" || normalized === "reviewer") {
      return normalized
    }
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const role = normalizeRole(entry)
      if (role) {
        return role
      }
    }
  }
  return null
}

export function deriveUserRoleFromMetadata(user: User | null): UserRole {
  if (!user) {
    return "reviewer"
  }

  const { user_metadata: userMetadata = {}, app_metadata: appMetadata = {} } = user

  const metadataRole =
    normalizeRole((appMetadata as Record<string, unknown>)?.role) ??
    normalizeRole((userMetadata as Record<string, unknown>)?.role)

  if (metadataRole) {
    return metadataRole
  }

  const appRoles = normalizeRole((appMetadata as Record<string, unknown>)?.roles)
  if (appRoles) {
    return appRoles
  }

  const userRoles = normalizeRole((userMetadata as Record<string, unknown>)?.roles)
  if (userRoles) {
    return userRoles
  }

  return "reviewer"
}

export function useAdminGuard() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [role, setRole] = useState<UserRole | null>(null)

  useEffect(() => {
    if (loading) {
      return
    }

    if (!user) {
      setRole(null)
      setChecked(true)
      router.replace("/login")
      return
    }

    const derivedRole = deriveUserRoleFromMetadata(user)
    setRole(derivedRole)
    setChecked(true)

    if (derivedRole !== "admin") {
      router.replace("/dashboard")
    }
  }, [loading, router, user])

  const guardLoading = loading || !checked
  const isAdmin = role === "admin"

  return {
    isAdmin,
    role,
    loading: guardLoading,
  }
}
