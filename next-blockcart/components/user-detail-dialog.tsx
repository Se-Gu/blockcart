"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { User, UserRole } from "@/lib/types"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

type ReceiptActivity = {
  id: string
  status?: string | null
  created_at?: string | null
  receipt_date?: string | null
  store?: string | null
  total?: number | null
}

interface UserDetailDialogProps {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdateRole?: (userId: string, role: UserRole) => Promise<void>
}

export function UserDetailDialog({ user, open, onOpenChange, onUpdateRole }: UserDetailDialogProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole>(user?.role || "reviewer")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [recentReceipts, setRecentReceipts] = useState<ReceiptActivity[]>([])
  const [isLoadingReceipts, setIsLoadingReceipts] = useState(false)
  const [receiptsError, setReceiptsError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (user) {
      setSelectedRole(user.role)
    }
  }, [user])

  useEffect(() => {
    if (!user || !open) {
      setRecentReceipts([])
      setReceiptsError(null)
      return
    }

    let isMounted = true
    const supabase = getSupabaseBrowserClient()

    const loadReceipts = async () => {
      setIsLoadingReceipts(true)
      setReceiptsError(null)

      const { data, error } = await supabase
        .from("receipts")
        .select("id, status, created_at, receipt_date, store, total")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5)

      if (!isMounted) return

      if (error) {
        console.error("Failed to load recent receipts", error)
        const message = error instanceof Error ? error.message : "Unable to load receipts"
        setReceiptsError(message)
        toast({
          title: "Failed to load receipts",
          description: message,
          variant: "destructive",
        })
        setRecentReceipts([])
      } else {
        setRecentReceipts(data ?? [])
      }

      setIsLoadingReceipts(false)
    }

    loadReceipts()

    return () => {
      isMounted = false
    }
  }, [open, user, toast])

  const handleUpdateRole = async () => {
    if (!user) return
    if (selectedRole === user.role) {
      onOpenChange(false)
      return
    }

    setIsSubmitting(true)
    try {
      await onUpdateRole?.(user.id, selectedRole)
      toast({
        title: "Role updated",
        description: `${user.email} is now ${selectedRole}.`,
      })
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to update role", error)
      const message = error instanceof Error ? error.message : "Something went wrong"
      toast({
        title: "Failed to update role",
        description: message,
        variant: "destructive",
      })
      setSelectedRole(user.role)
    } finally {
      setIsSubmitting(false)
    }
  }

  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 2,
      }),
    []
  )

  if (!user) {
    return null
  }

  const lifetimeTokens = user.lifetime_tokens ?? user.total_rewards ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Full Name</Label>
              <p className="text-sm font-medium">{user.full_name || "—"}</p>
            </div>

            <div>
              <Label className="text-muted-foreground">Email</Label>
              <p className="text-sm font-medium">{user.email}</p>
            </div>

            <div>
              <Label className="text-muted-foreground">Wallet Address</Label>
              {user.wallet_address ? (
                <p className="font-mono text-xs sm:text-sm break-all">
                  {user.wallet_address}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No wallet on file</p>
              )}
            </div>

            {user.referral_code && (
              <div>
                <Label className="text-muted-foreground">Referral Code</Label>
                <p className="text-sm font-medium">{user.referral_code}</p>
              </div>
            )}

            <div>
              <Label className="text-muted-foreground">Current Role</Label>
              <div className="mt-1">
                <Badge variant="secondary" className="capitalize">
                  {user.role}
                </Badge>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground">Member Since</Label>
              <p className="text-sm font-medium">
                {new Date(user.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>

            {user.last_login && (
              <div>
                <Label className="text-muted-foreground">Last Login</Label>
                <p className="text-sm font-medium">
                  {new Date(user.last_login).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <div>
              <Label className="text-muted-foreground">Lifetime Tokens</Label>
              <p className="text-sm font-medium">{numberFormatter.format(lifetimeTokens)}</p>
            </div>

            <div>
              <Label className="text-muted-foreground">Recent Receipts</Label>
              <div className="mt-2 space-y-2">
                {isLoadingReceipts ? (
                  <p className="text-sm text-muted-foreground">Loading receipts...</p>
                ) : receiptsError ? (
                  <p className="text-sm text-destructive">{receiptsError}</p>
                ) : recentReceipts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent receipts</p>
                ) : (
                  recentReceipts.map((receipt) => {
                    const amount = receipt.total ?? 0
                    const storeName = receipt.store ?? "Unknown store"
                    const displayDate = receipt.receipt_date ?? receipt.created_at

                    return (
                      <div
                        key={receipt.id}
                        className="rounded-md border border-border p-3 text-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">{storeName}</p>
                          {receipt.status && (
                            <Badge variant="outline" className="capitalize">
                              {receipt.status}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>
                            {displayDate
                              ? new Date(displayDate).toLocaleDateString()
                              : "Date unavailable"}
                          </span>
                          <span>
                            {Number.isFinite(amount) ? numberFormatter.format(Number(amount)) : "—"}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <Label htmlFor="role-select">Update Role</Label>
            <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as UserRole)}>
              <SelectTrigger id="role-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reviewer">Reviewer</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleUpdateRole} disabled={isSubmitting || selectedRole === user.role} className="flex-1">
              {isSubmitting ? "Updating..." : "Update Role"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
