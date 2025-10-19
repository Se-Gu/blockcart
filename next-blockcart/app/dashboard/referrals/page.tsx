"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, UserPlus, TrendingUp, Loader2, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { Referral } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";

const STATUS_VALUES: Referral["status"][] = ["pending", "completed"];

type SupabaseReferralRow = {
  id: string;
  referrer: string | null;
  referee: string | null;
  bonus: number | string | null;
  status: string | null;
  created_at: string;
  updated_at?: string | null;
  referrer_user?: {
    id: string;
    email?: string | null;
  } | null;
  referee_user?: {
    id: string;
    email?: string | null;
  } | null;
};

const mapReferralRow = (row: SupabaseReferralRow): Referral => {
  const rawStatus =
    typeof row.status === "string"
      ? (row.status.toLowerCase() as Referral["status"])
      : "pending";
  const status =
    rawStatus && STATUS_VALUES.includes(rawStatus) ? rawStatus : "pending";
  const bonusAmount =
    typeof row.bonus === "number" ? row.bonus : Number(row.bonus ?? 0);

  return {
    id: row.id,
    referrer: row.referrer ?? "",
    referrer_email: row.referrer_user?.email ?? "Unknown referrer",
    referee: row.referee ?? "",
    referee_email: row.referee_user?.email ?? "Unknown referee",
    status,
    bonus: Number.isFinite(bonusAmount) ? bonusAmount : 0,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
  };
};

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Referral["status"] | "all">(
    "all"
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { user } = useAuth();

  const isAdmin = useMemo(() => {
    const appMetadata = (user?.app_metadata ?? {}) as Record<string, unknown>;
    const userMetadata = (user?.user_metadata ?? {}) as Record<string, unknown>;

    const hasAdminRole = (metadata: Record<string, unknown>) => {
      const metadataRole = metadata?.["role"];
      const metadataRoles = metadata?.["roles"];

      if (typeof metadataRole === "string" && metadataRole === "admin") {
        return true;
      }

      if (
        Array.isArray(metadataRoles) &&
        metadataRoles.map((role) => `${role}`).includes("admin")
      ) {
        return true;
      }

      return false;
    };

    if (hasAdminRole(appMetadata) || hasAdminRole(userMetadata)) {
      return true;
    }

    // Fallback: the dashboard layout currently assumes authenticated users are admins
    return true;
  }, [user]);

  const fetchReferrals = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("referrals")
      .select(
        `
        id,
        referrer,
        referee,
        bonus,
        status,
        created_at,
        updated_at,
        referrer_user:referrer (
          id,
          email
        ),
        referee_user:referee (
          id,
          email
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load referrals", error);
      setLoadError(error.message);
      setReferrals([]);
      toast({
        variant: "destructive",
        title: "Unable to load referrals",
        description: error.message,
      });
      setIsLoading(false);
      return;
    }

    const mappedReferrals = (data ?? []).map(mapReferralRow);
    setReferrals(mappedReferrals);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void fetchReferrals();
  }, [fetchReferrals]);

  const filteredReferrals = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return referrals.filter((referral) => {
      const matchesSearch =
        query.length === 0 ||
        referral.referrer_email.toLowerCase().includes(query) ||
        referral.referee_email.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" || referral.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [referrals, searchQuery, statusFilter]);

  const metrics = useMemo(() => {
    const totals = referrals.reduce(
      (acc, referral) => {
        acc.total += 1;
        if (referral.status === "completed") {
          acc.completed += 1;
          acc.rewards += referral.bonus;
        }
        if (referral.status === "pending") {
          acc.pending += 1;
        }
        return acc;
      },
      { total: 0, completed: 0, pending: 0, rewards: 0 }
    );

    return {
      totalReferrals: totals.total,
      completedReferrals: totals.completed,
      pendingReferrals: totals.pending,
      totalRewards: totals.rewards,
    };
  }, [referrals]);

  const topReferrers = useMemo(() => {
    const referrerStats = referrals.reduce((acc, ref) => {
      const key = ref.referrer_email || "Unknown referrer";
      if (!acc[key]) {
        acc[key] = { total: 0, completed: 0 };
      }
      acc[key].total += 1;
      if (ref.status === "completed") {
        acc[key].completed += 1;
      }
      return acc;
    }, {} as Record<string, { total: number; completed: number }>);

    return Object.entries(referrerStats)
      .sort((a, b) => b[1].completed - a[1].completed)
      .slice(0, 5);
  }, [referrals]);

  const handleExportCsv = () => {
    if (!referrals.length) {
      toast({
        variant: "destructive",
        title: "No referrals to export",
        description: "Add referrals before exporting to CSV.",
      });
      return;
    }

    const escapeValue = (value: string | number | undefined) => {
      if (value === undefined || value === null) return "";
      const stringValue = `${value}`;
      if (stringValue.includes(",") || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const header = [
      "Referral ID",
      "Referrer Email",
      "Referee Email",
      "Status",
      "Reward Amount",
      "Created At",
      "Completed At",
    ];

    const rows = referrals.map((referral) => [
      escapeValue(referral.id),
      escapeValue(referral.referrer_email),
      escapeValue(referral.referee_email),
      escapeValue(referral.status),
      escapeValue(referral.bonus.toFixed(2)),
      escapeValue(new Date(referral.created_at).toISOString()),
      escapeValue(
        referral.completed_at
          ? new Date(referral.completed_at).toISOString()
          : ""
      ),
    ]);

    const csvContent = [header, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `referrals-${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Export started",
      description: "Your CSV download has begun.",
    });
  };

  const getStatusBadge = (status: Referral["status"]) => {
    const variants = {
      pending: "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20",
      completed: "bg-green-500/10 text-green-600 hover:bg-green-500/20",
    };
    return (
      <Badge variant="secondary" className={variants[status]}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Referrals</h1>
        <p className="text-muted-foreground mt-1">
          Track user referrals and rewards
        </p>
      </div>

      {loadError && (
        <div className="border border-destructive/20 bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
          {loadError}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Referrals</p>
              <p className="text-2xl font-bold">{metrics.totalReferrals}</p>
            </div>
            <UserPlus className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold">{metrics.completedReferrals}</p>
            </div>
            <UserPlus className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">{metrics.pendingReferrals}</p>
            </div>
            <UserPlus className="h-8 w-8 text-yellow-600" />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Rewards</p>
              <p className="text-2xl font-bold">
                ${metrics.totalRewards.toFixed(2)}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Top Referrers */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Top Referrers</h2>
        <div className="space-y-3">
          {topReferrers.map(([email, stats], index) => (
            <div key={email} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium">{email}</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.completed} completed of {stats.total} total
                  </p>
                </div>
              </div>
              <Badge variant="secondary">{stats.completed} referrals</Badge>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by referrer or referee email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value as Referral["status"] | "all")
            }
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          {isAdmin && (
            <Button
              variant="outline"
              className="sm:ml-2"
              onClick={handleExportCsv}
              disabled={isLoading || !referrals.length}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Referrals Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Referrer</TableHead>
              <TableHead>Referee</TableHead>
              <TableHead>Reward Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Completed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-32 text-center text-muted-foreground"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading referrals...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredReferrals.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground h-32"
                >
                  No referrals found
                </TableCell>
              </TableRow>
            ) : (
              filteredReferrals.map((referral) => (
                <TableRow key={referral.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    {referral.referrer_email}
                  </TableCell>
                  <TableCell>{referral.referee_email}</TableCell>
                  <TableCell className="font-medium">
                    ${referral.bonus.toFixed(2)}
                  </TableCell>
                  <TableCell>{getStatusBadge(referral.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(referral.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {referral.completed_at
                      ? new Date(referral.completed_at).toLocaleDateString()
                      : "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
