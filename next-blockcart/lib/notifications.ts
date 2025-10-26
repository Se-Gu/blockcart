"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ReviewerNotification, ReviewerNotificationRecord } from "@/lib/types";

function mapNotification(row: ReviewerNotificationRecord): ReviewerNotification {
  const receipt = row.receipt
    ? {
        id: row.receipt.id,
        store_name: row.receipt.store,
        total_amount:
          typeof row.receipt.total === "number"
            ? Number(row.receipt.total)
            : row.receipt.total
            ? Number(row.receipt.total)
            : 0,
        receipt_date: row.receipt.receipt_date,
        status: row.receipt.status,
        created_at: row.receipt.created_at,
        image_url: row.receipt.image_url,
      }
    : undefined;

  return {
    id: row.id,
    reviewer_id: row.reviewer_id,
    receipt_id: row.receipt_id,
    assignment_id: row.assignment_id,
    created_at: row.created_at,
    read_at: row.read_at ?? null,
    metadata: row.metadata ?? {},
    receipt,
  };
}

export function useReviewerNotifications(reviewerId: string | null | undefined) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [notifications, setNotifications] = useState<ReviewerNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!reviewerId) {
      setNotifications([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("reviewer_notifications")
        .select(
          `id, reviewer_id, receipt_id, assignment_id, created_at, read_at, metadata,
           receipt:receipts (id, store, total, receipt_date, status, created_at, image_url)`
        )
        .eq("reviewer_id", reviewerId)
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      const mapped = (data ?? []).map((row) =>
        mapNotification(row as ReviewerNotificationRecord)
      );

      setNotifications(mapped);
    } catch (err) {
      console.error("Failed to load reviewer notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [reviewerId, supabase]);

  const markNotificationsAsRead = useCallback(
    async (notificationIds: string[]) => {
      if (!notificationIds.length) {
        return;
      }

      try {
        const { error } = await supabase
          .from("reviewer_notifications")
          .update({ read_at: new Date().toISOString() })
          .in("id", notificationIds);

        if (error) throw error;

        const readTimestamp = new Date().toISOString();
        setNotifications((prev) =>
          prev.map((notification) =>
            notificationIds.includes(notification.id)
              ? { ...notification, read_at: readTimestamp }
              : notification
          )
        );
      } catch (err) {
        console.error("Failed to mark notifications as read:", err);
      }
    },
    [supabase]
  );

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read_at).length,
    [notifications]
  );

  return {
    notifications,
    unreadCount,
    loading,
    refresh: fetchNotifications,
    markNotificationsAsRead,
  };
}
