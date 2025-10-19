"use client"

import { useState } from "react"
import { Search, UserPlus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { UserDetailDialog } from "@/components/user-detail-dialog"
import type { User, UserRole } from "@/lib/types"

// Mock data - in production, fetch from Supabase
const mockUsers: User[] = [
  {
    id: "u1",
    email: "admin@blockcart.com",
    full_name: "Admin User",
    role: "admin",
    created_at: "2024-01-01T00:00:00Z",
    last_login: "2025-01-15T10:30:00Z",
  },
  {
    id: "u2",
    email: "reviewer1@blockcart.com",
    full_name: "John Reviewer",
    role: "reviewer",
    created_at: "2024-02-15T00:00:00Z",
    last_login: "2025-01-14T15:20:00Z",
  },
  {
    id: "u3",
    email: "reviewer2@blockcart.com",
    full_name: "Jane Reviewer",
    role: "reviewer",
    created_at: "2024-03-10T00:00:00Z",
    last_login: "2025-01-13T09:45:00Z",
  },
  {
    id: "u4",
    email: "admin2@blockcart.com",
    full_name: "Sarah Admin",
    role: "admin",
    created_at: "2024-01-20T00:00:00Z",
    last_login: "2025-01-15T08:15:00Z",
  },
  {
    id: "u5",
    email: "reviewer3@blockcart.com",
    full_name: "Mike Reviewer",
    role: "reviewer",
    created_at: "2024-04-05T00:00:00Z",
    last_login: "2025-01-12T14:30:00Z",
  },
]

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>(mockUsers)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all")

  const handleUpdateRole = async (userId: string, role: UserRole) => {
    console.log("[v0] Updating user role:", userId, "to", role)
    // Placeholder for Supabase update
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)))
  }

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesRole = roleFilter === "all" || user.role === roleFilter

    return matchesSearch && matchesRole
  })

  const getRoleBadge = (role: UserRole) => {
    const variants = {
      admin: "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20",
      reviewer: "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20",
    }
    return (
      <Badge variant="secondary" className={variants[role]}>
        {role}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground mt-1">Manage admin and reviewer accounts</p>
        </div>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as UserRole | "all")}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="reviewer">Reviewer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Member Since</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground h-32">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.last_login ? new Date(user.last_login).toLocaleDateString() : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user)
                        setDialogOpen(true)
                      }}
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* User Detail Dialog */}
      <UserDetailDialog
        user={selectedUser}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onUpdateRole={handleUpdateRole}
      />
    </div>
  )
}
