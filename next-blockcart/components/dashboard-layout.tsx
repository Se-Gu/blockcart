"use client";

import type React from "react";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  Users,
  Megaphone,
  Gift,
  UserPlus,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Bell,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useReviewerNotifications } from "@/lib/notifications";

interface DashboardLayoutProps {
  children: React.ReactNode;
  userRole: UserRole;
  userEmail: string;
  userName: string;
}

const adminNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/users", label: "Users", icon: Users },
  { href: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/dashboard/rewards", label: "Rewards", icon: Gift },
  { href: "/dashboard/referrals", label: "Referrals", icon: UserPlus },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/settings", label: "Platform Settings", icon: Settings },
];

const reviewerNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/receipts", label: "Receipts", icon: Receipt },
];

export function DashboardLayout({
  children,
  userRole,
  userEmail,
  userName,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const pathname = usePathname();
  const { signOut, user } = useAuth();
  const navItems = userRole === "admin" ? adminNavItems : reviewerNavItems;
  const displayName = userName || userEmail;
  const userInitial = (displayName?.[0] ?? "").toUpperCase() || "?";
  const reviewerId = user?.id ?? null;
  const {
    notifications,
    unreadCount,
    loading: notificationsLoading,
    markNotificationsAsRead,
    refresh: refreshNotifications,
  } = useReviewerNotifications(reviewerId);
  const wasNotificationsOpen = useRef(false);

  useEffect(() => {
    if (!notificationsOpen) {
      return;
    }

    const unreadIds = notifications
      .filter((notification) => !notification.read_at)
      .map((notification) => notification.id);

    if (unreadIds.length > 0) {
      void markNotificationsAsRead(unreadIds);
    }
  }, [notificationsOpen, notifications, markNotificationsAsRead]);

  useEffect(() => {
    if (!notificationsOpen && wasNotificationsOpen.current) {
      void refreshNotifications();
    }

    wasNotificationsOpen.current = notificationsOpen;
  }, [notificationsOpen, refreshNotifications]);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const formatDateTime = (value: unknown) => {
    if (!value || typeof value !== "string") {
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed.toLocaleString();
  };

  const formatCurrency = (value: unknown) => {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return null;
    }

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const getMetadataString = (
    metadata: Record<string, unknown> | undefined,
    key: string
  ) => {
    if (!metadata) {
      return undefined;
    }

    const value = metadata[key];
    return typeof value === "string" ? value : undefined;
  };

  const getMetadataNumber = (
    metadata: Record<string, unknown> | undefined,
    key: string
  ) => {
    if (!metadata) {
      return undefined;
    }

    const value = metadata[key];
    return typeof value === "number" ? value : undefined;
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform border-r border-border bg-card transition-transform duration-200 ease-in-out lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b border-border px-6">
            <h1 className="text-xl font-bold text-foreground">Blockcart</h1>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto p-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User info & logout */}
          <div className="border-t border-border p-4">
            <div className="mb-3 flex items-center gap-3 px-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {userInitial}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium text-foreground">
                  {displayName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {userEmail}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {userRole}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 bg-transparent"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center gap-4 border-b border-border bg-card px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          {userRole === "reviewer" && (
            <Popover
              open={notificationsOpen}
              onOpenChange={(open) => setNotificationsOpen(open)}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative rounded-full border border-border"
                  aria-label="Reviewer notifications"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-sm font-medium text-foreground">
                    Notifications
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {unreadCount > 0
                      ? `${unreadCount} new assignment${unreadCount === 1 ? "" : "s"}`
                      : "No unread assignments"}
                  </p>
                </div>
                <ScrollArea className="max-h-80">
                  <div className="space-y-2 p-3">
                    {notificationsLoading ? (
                      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading notifications...
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        You're all caught up.
                      </div>
                    ) : (
                      notifications.map((notification) => {
                        const metadataStore = getMetadataString(
                          notification.metadata,
                          "store_name"
                        );
                        const receiptLabel =
                          notification.receipt?.store_name ||
                          metadataStore ||
                          `Receipt ${notification.receipt_id}`;
                        const receiptDate =
                          notification.receipt?.receipt_date ||
                          getMetadataString(
                            notification.metadata,
                            "receipt_date"
                          ) ||
                          null;
                        const uploadedAt =
                          getMetadataString(
                            notification.metadata,
                            "uploaded_at"
                          ) ||
                          notification.created_at;
                        const totalAmount =
                          notification.receipt?.total_amount ??
                          getMetadataNumber(notification.metadata, "total");

                        return (
                          <Link
                            key={notification.id}
                            href={`/dashboard/receipts/${notification.receipt_id}`}
                            className="block rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-left text-sm transition-colors hover:border-border hover:bg-accent/60"
                            onClick={() => setNotificationsOpen(false)}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-foreground">
                                Receipt assigned
                              </span>
                              {notification.read_at ? (
                                <span className="text-[10px] uppercase text-muted-foreground">
                                  Read
                                </span>
                              ) : (
                                <Badge variant="secondary" className="text-[10px] uppercase">
                                  New
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {receiptLabel}
                            </p>
                            {receiptDate && (
                              <p className="text-xs text-muted-foreground">
                                Purchase date: {formatDateTime(receiptDate) ?? receiptDate}
                              </p>
                            )}
                            {typeof totalAmount === "number" && !Number.isNaN(totalAmount) && (
                              <p className="text-xs text-muted-foreground">
                                Total: {formatCurrency(totalAmount) ?? totalAmount}
                              </p>
                            )}
                            <p className="mt-1 text-xs text-muted-foreground">
                              Assigned: {formatDateTime(uploadedAt) ?? uploadedAt}
                            </p>
                          </Link>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-3 rounded-full border border-border px-2 py-1.5 text-left shadow-sm transition-colors hover:bg-accent/60 focus-visible:ring-0"
              >
                <Avatar>
                  <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden min-w-0 flex-col items-start sm:flex">
                  <span className="max-w-[140px] truncate text-sm font-medium text-foreground">
                    {displayName}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {userEmail}
                  </span>
                </div>
                <span className="hidden text-xs capitalize text-muted-foreground sm:block">
                  {userRole}
                </span>
                <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-1">
                  <span className="truncate text-sm font-medium text-foreground">
                    {displayName}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {userEmail}
                  </span>
                  <span className="text-xs capitalize text-muted-foreground">
                    {userRole}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={(event) => {
                  event.preventDefault();
                  void handleLogout();
                }}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
