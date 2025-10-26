"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserDetailDialog } from "@/components/user-detail-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { User, UserRole } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { inviteReviewer } from "@/lib/admin";
import { useToast } from "@/hooks/use-toast";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("reviewer");
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchUsers = useCallback(async () => {
    if (!isMountedRef.current) return;

    setIsLoading(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();

    try {
      const [
        usersResponse,
        webUsersResponse,
        rewardsResponse,
        referralsResponse,
      ] = await Promise.all([
        supabase
          .from("users")
          .select(
            "id, email, wallet_address, referral_code, created_at, updated_at"
          ),
        supabase.from("web_users").select("id, email, role"),
        supabase.from("rewards").select("user_id, amount"),
        supabase.from("referrals").select("referrer, bonus"),
      ]);

      if (usersResponse.error) {
        throw usersResponse.error;
      }

      if (webUsersResponse.error) {
        throw webUsersResponse.error;
      }

      if (rewardsResponse.error) {
        throw rewardsResponse.error;
      }

      if (referralsResponse.error) {
        throw referralsResponse.error;
      }

      const rewardTotals = new Map<string, number>();
      rewardsResponse.data?.forEach((reward) => {
        const userId = reward.user_id;
        const amount =
          typeof reward.amount === "number"
            ? reward.amount
            : Number(reward.amount);
        if (!userId || Number.isNaN(amount)) return;
        rewardTotals.set(userId, (rewardTotals.get(userId) ?? 0) + amount);
      });

      const referralStats = new Map<string, { count: number; bonus: number }>();
      referralsResponse.data?.forEach((referral) => {
        const referrerId =
          (referral as { referrer?: string | null }).referrer ?? null;

        if (!referrerId) return;

        const rawBonus =
          (referral as { bonus?: number | string | null }).bonus ?? 0;

        const bonus =
          typeof rawBonus === "number" ? rawBonus : Number(rawBonus);
        const stats = referralStats.get(referrerId) ?? { count: 0, bonus: 0 };
        stats.count += 1;
        if (!Number.isNaN(bonus)) {
          stats.bonus += bonus;
        }
        referralStats.set(referrerId, stats);
      });

      const roleMap = new Map<string, UserRole>();
      webUsersResponse.data?.forEach((webUser) => {
        const webUserId = (webUser as { id?: string | null }).id;
        const role = (webUser as { role?: string | null }).role;
        if (!webUserId) return;
        if (role === "admin" || role === "reviewer") {
          roleMap.set(webUserId, role);
        }
      });

      const userRows = usersResponse.data ?? [];
      const webUserRows = webUsersResponse.data ?? [];
      
      // Create a map of existing users to avoid duplicates
      const existingUserIds = new Set(userRows.map(user => user.id));
      
      // Map users from the users table
      const mappedUsers: User[] = userRows.map((profile) => {
        const rewardTotal = rewardTotals.get(profile.id) ?? 0;
        const referral = referralStats.get(profile.id);
        const lifetimeTokens = rewardTotal + (referral?.bonus ?? 0);
        const role = roleMap.get(profile.id) ?? "reviewer";

        return {
          id: profile.id,
          email: profile.email,
          full_name: null,
          role,
          created_at: profile.created_at,
          last_login: profile.updated_at ?? null,
          wallet_address: profile.wallet_address ?? null,
          referral_code:
            (profile as { referral_code?: string | null }).referral_code ??
            null,
          total_rewards: rewardTotal,
          referral_count: referral?.count ?? 0,
          lifetime_tokens: lifetimeTokens,
        };
      });

      // Map web_users that don't exist in the users table
      const webOnlyUsers: User[] = webUserRows
        .filter(webUser => !existingUserIds.has(webUser.id))
        .map((webUser) => {
          const rewardTotal = rewardTotals.get(webUser.id) ?? 0;
          const referral = referralStats.get(webUser.id);
          const lifetimeTokens = rewardTotal + (referral?.bonus ?? 0);
          const role = roleMap.get(webUser.id) ?? "reviewer";

          return {
            id: webUser.id,
            email: webUser.email,
            full_name: null,
            role,
            created_at: new Date().toISOString(), // Default to current time if no created_at
            last_login: null,
            wallet_address: null,
            referral_code: null,
            total_rewards: rewardTotal,
            referral_count: referral?.count ?? 0,
            lifetime_tokens: lifetimeTokens,
          };
        });

      const nextUsers: User[] = [...mappedUsers, ...webOnlyUsers];

      if (isMountedRef.current) {
        setUsers(nextUsers);
      }
    } catch (err) {
      console.error("Failed to load users", err);
      if (!isMountedRef.current) return;
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setUsers([]);
      toast({
        title: "Failed to load users",
        description: message,
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const selectedUser = selectedUserId
    ? users.find((user) => user.id === selectedUserId) ?? null
    : null;

  useEffect(() => {
    if (!dialogOpen) {
      setSelectedUserId(null);
    }
  }, [dialogOpen]);

  const handleUpdateRole = useCallback(
    async (userId: string, role: UserRole) => {
      const supabase = getSupabaseBrowserClient();

      const { error: upsertError } = await supabase.from("web_users").upsert(
        {
          id: userId,
          role,
        },
        { onConflict: "id" }
      );

      if (upsertError) {
        console.error("Failed to update user role", upsertError);
        throw new Error(upsertError.message ?? "Unable to update role");
      }

      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId
            ? {
                ...user,
                role,
              }
            : user
        )
      );

      await fetchUsers();
    },
    [fetchUsers]
  );

  const handleAddUser = useCallback(async () => {
    if (!newUserEmail.trim()) {
      toast({
        title: "Email required",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    setIsAddingUser(true);
    try {
      // Use the inviteReviewer function to create the user
      await inviteReviewer(newUserEmail.trim(), undefined);
      
      // If the role is admin, update it after creation
      if (newUserRole === "admin") {
        const supabase = getSupabaseBrowserClient();
        // We need to find the user ID first, but since inviteReviewer doesn't return the ID,
        // we'll refresh the users list and the role will be updated via the web_users table
        await fetchUsers();
        
        // Find the newly created user and update their role
        const newUser = users.find(user => user.email === newUserEmail.trim());
        if (newUser) {
          await supabase.from("web_users").upsert(
            {
              id: newUser.id,
              role: "admin",
            },
            { onConflict: "id" }
          );
        }
      } else {
        await fetchUsers();
      }

      toast({
        title: "User added successfully",
        description: `${newUserEmail} has been added as a ${newUserRole}`,
      });

      setNewUserEmail("");
      setNewUserRole("reviewer");
      setAddUserDialogOpen(false);
    } catch (error) {
      console.error("Failed to add user", error);
      const message = error instanceof Error ? error.message : "Failed to add user";
      toast({
        title: "Failed to add user",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsAddingUser(false);
    }
  }, [newUserEmail, newUserRole, fetchUsers, users, toast]);

  const filteredUsers = users.filter((user) => {
    const normalizedSearch = searchQuery.toLowerCase();
    const matchesSearch =
      (user.full_name ?? "").toLowerCase().includes(normalizedSearch) ||
      user.email.toLowerCase().includes(normalizedSearch);

    const matchesRole = roleFilter === "all" || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: UserRole) => {
    const variants: Record<UserRole, string> = {
      admin: "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20",
      reviewer: "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20",
    };
    return (
      <Badge variant="secondary" className={variants[role]}>
        {role}
      </Badge>
    );
  };

  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 2,
      }),
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground mt-1">
            Manage admin and reviewer accounts
          </p>
        </div>
        <Button onClick={() => setAddUserDialogOpen(true)}>
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

        <Select
          value={roleFilter}
          onValueChange={(value) => setRoleFilter(value as UserRole | "all")}
        >
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
              <TableHead>Wallet</TableHead>
              <TableHead>Referral Code</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Rewards Earned</TableHead>
              <TableHead>Member Since</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center text-muted-foreground h-32"
                >
                  Loading users...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center text-destructive h-32"
                >
                  Failed to load users: {error}
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center text-muted-foreground h-32"
                >
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow
                  key={user.id}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <TableCell className="font-medium">
                    {user.full_name || "—"}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell className="font-mono text-xs sm:text-sm">
                    {user.wallet_address || "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {user.referral_code || "—"}
                  </TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {numberFormatter.format(user.total_rewards ?? 0)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.last_login
                      ? new Date(user.last_login).toLocaleDateString()
                      : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedUserId(user.id);
                        setDialogOpen(true);
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
        open={dialogOpen && !!selectedUser}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSelectedUserId(null);
          }
        }}
        onUpdateRole={handleUpdateRole}
      />

      {/* Add User Dialog */}
      <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={newUserRole} onValueChange={(value) => setNewUserRole(value as UserRole)}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reviewer">Reviewer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAddUserDialogOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleAddUser} disabled={isAddingUser || !newUserEmail.trim()} className="flex-1">
                {isAddingUser ? "Adding..." : "Add User"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
