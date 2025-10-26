import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import type { ReviewNotification } from "../types";

type NotificationsContextValue = {
  notifications: ReviewNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markNotificationAsRead: (
    notificationId: string,
  ) => Promise<ReviewNotification | null>;
  dismissNotification: (notificationId: string) => Promise<void>;
  dismissAll: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | undefined>(
  undefined,
);

type NotificationsProviderProps = {
  children: ReactNode;
};

const selectColumns =
  "id, receipt_id, user_id, title, message, status, metadata, created_at, read_at";

export function NotificationsProvider({ children }: NotificationsProviderProps) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [notifications, setNotifications] = useState<ReviewNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUnreadNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("review_notifications")
        .select(selectColumns)
        .eq("user_id", userId)
        .eq("status", "unread")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setNotifications((data ?? []) as ReviewNotification[]);
    } catch (error) {
      console.error("[NotificationsProvider] Failed to fetch notifications", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      return;
    }

    void fetchUnreadNotifications();
  }, [fetchUnreadNotifications, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const channel = supabase
      .channel(`review-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "review_notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = payload.new as ReviewNotification | null;
          if (!newNotification) {
            return;
          }

          setNotifications((current) => {
            const alreadyExists = current.some(
              (item) => item.id === newNotification.id,
            );
            if (alreadyExists) {
              return current;
            }

            return [newNotification, ...current];
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const markNotificationAsRead = useCallback(
    async (notificationId: string) => {
      if (!userId) {
        return null;
      }

      try {
        const { data, error } = await supabase
          .from("review_notifications")
          .update({
            status: "read",
            read_at: new Date().toISOString(),
          })
          .eq("id", notificationId)
          .eq("user_id", userId)
          .select(selectColumns)
          .maybeSingle();

        if (error) {
          throw error;
        }

        setNotifications((current) =>
          current.filter((notification) => notification.id !== notificationId),
        );

        return (data as ReviewNotification | null) ?? null;
      } catch (error) {
        console.error(
          `[NotificationsProvider] Failed to mark notification ${notificationId} as read`,
          error,
        );
        return null;
      }
    },
    [userId],
  );

  const dismissNotification = useCallback(
    async (notificationId: string) => {
      await markNotificationAsRead(notificationId);
    },
    [markNotificationAsRead],
  );

  const dismissAll = useCallback(async () => {
    if (!userId || notifications.length === 0) {
      return;
    }

    try {
      await supabase
        .from("review_notifications")
        .update({
          status: "read",
          read_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("status", "unread");

      setNotifications([]);
    } catch (error) {
      console.error("[NotificationsProvider] Failed to dismiss all notifications", error);
    }
  }, [notifications.length, userId]);

  const contextValue = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unreadCount: notifications.length,
      loading,
      refresh: fetchUnreadNotifications,
      markNotificationAsRead,
      dismissNotification,
      dismissAll,
    }),
    [
      dismissAll,
      dismissNotification,
      fetchUnreadNotifications,
      loading,
      markNotificationAsRead,
      notifications,
    ],
  );

  return (
    <NotificationsContext.Provider value={contextValue}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationsProvider");
  }

  return context;
}
