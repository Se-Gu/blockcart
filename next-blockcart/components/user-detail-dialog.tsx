"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { User, UserRole } from "@/lib/types"

interface UserDetailDialogProps {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdateRole?: (userId: string, role: UserRole) => void
}

export function UserDetailDialog({ user, open, onOpenChange, onUpdateRole }: UserDetailDialogProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole>(user?.role || "reviewer")
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!user) return null

  const handleUpdateRole = async () => {
    if (selectedRole === user.role) {
      onOpenChange(false)
      return
    }

    setIsSubmitting(true)
    await onUpdateRole?.(user.id, selectedRole)
    setIsSubmitting(false)
    onOpenChange(false)
  }

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
              <p className="text-sm font-medium">{user.full_name}</p>
            </div>

            <div>
              <Label className="text-muted-foreground">Email</Label>
              <p className="text-sm font-medium">{user.email}</p>
            </div>

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
