"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { UserRole } from "@/lib/types"
import { useAuth } from "@/lib/auth-context"
import { deriveUserRoleFromMetadata, isWebUser } from "@/lib/roles"

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

    if (!isWebUser(user)) {
      setRole(null)
      setChecked(true)
      router.replace("/login?access_denied=true")
      return
    }

    const derivedRole = deriveUserRoleFromMetadata(user)
    setRole(derivedRole)
    setChecked(true)
  }, [loading, router, user])

  const guardLoading = loading || !checked
  const isAdmin = role === "admin"

  return {
    isAdmin,
    role,
    loading: guardLoading,
  }
}
