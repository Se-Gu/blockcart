"use client";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import {
  Badge,
  Button,
  Dialog,
  IconButton,
  Menu,
  Portal,
  Text,
  useTheme,
} from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationsContext";
import type { ReviewNotification } from "../types";

interface AppHeaderProps {
  title?: string;
  canGoBack?: boolean;
  onBackPress?: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToReceipt?: (receiptId: string) => void;
}

export default function AppHeader({
  title,
  canGoBack,
  onBackPress,
  onNavigateToProfile,
  onNavigateToReceipt,
}: AppHeaderProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);
  const [notificationDialogVisible, setNotificationDialogVisible] =
    useState(false);
  const {
    notifications,
    unreadCount,
    loading,
    dismissNotification,
    dismissAll,
    markNotificationAsRead,
  } = useNotifications();

  const hasNotifications = unreadCount > 0;
  const displayCount = useMemo(() => {
    if (unreadCount > 99) {
      return "99+";
    }

    if (unreadCount > 9) {
      return "9+";
    }

    return String(unreadCount);
  }, [unreadCount]);

  const closeMenu = useCallback(() => {
    setMenuVisible(false);
  }, []);

  const handleProfilePress = useCallback(() => {
    closeMenu();
    onNavigateToProfile?.();
  }, [closeMenu, onNavigateToProfile]);

  const handleSignOut = useCallback(() => {
    closeMenu();
    void signOut();
  }, [closeMenu, signOut]);

  const openNotifications = useCallback(() => {
    setNotificationDialogVisible(true);
  }, []);

  const closeNotifications = useCallback(() => {
    setNotificationDialogVisible(false);
  }, []);

  const handleViewNotification = useCallback(
    async (notification: ReviewNotification) => {
      const result = await markNotificationAsRead(notification.id);
      closeNotifications();
      if (result?.receipt_id) {
        onNavigateToReceipt?.(result.receipt_id);
      } else {
        onNavigateToReceipt?.(notification.receipt_id);
      }
    },
    [closeNotifications, markNotificationAsRead, onNavigateToReceipt],
  );

  const handleDismissNotification = useCallback(
    async (notificationId: string) => {
      await dismissNotification(notificationId);
    },
    [dismissNotification],
  );

  const handleDismissAll = useCallback(async () => {
    await dismissAll();
    closeNotifications();
  }, [closeNotifications, dismissAll]);

  return (
    <LinearGradient
      colors={[theme.colors.primary, theme.colors.secondary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{
        paddingTop: insets.top + spacing.md,
        paddingBottom: spacing.md,
        paddingHorizontal: spacing.md,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {canGoBack ? (
          <IconButton
            icon="arrow-left"
            iconColor="#FFFFFF"
            size={24}
            onPress={onBackPress}
          />
        ) : (
          <View style={{ width: 40 }} />
        )}

        <Text
          variant="headlineSmall"
          style={{
            color: theme.colors.onPrimary,
            fontWeight: "600",
            textAlign: "center",
            letterSpacing: 0.5,
            flexShrink: 1,
          }}
        >
          {title || "Blockcart"}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ marginRight: spacing.xs }}>
            <IconButton
              icon={hasNotifications ? "bell-badge" : "bell-outline"}
              iconColor="#FFFFFF"
              size={26}
              onPress={openNotifications}
              accessibilityLabel="Notifications"
            />
            {hasNotifications ? (
              <Badge
                style={{
                  position: "absolute",
                  top: spacing.xs,
                  right: spacing.xs,
                  backgroundColor: theme.colors.error,
                  color: "#FFFFFF",
                }}
              >
                {displayCount}
              </Badge>
            ) : null}
          </View>

          <Menu
            visible={menuVisible}
            onDismiss={closeMenu}
            anchor={
              <IconButton
                icon="account-circle"
                iconColor="#FFFFFF"
                size={28}
                onPress={() => setMenuVisible(true)}
              />
            }
            contentStyle={{ backgroundColor: theme.colors.surface }}
          >
            <Menu.Item onPress={handleProfilePress} title="Profile" />
            <Menu.Item onPress={handleSignOut} title="Sign out" />
          </Menu>
        </View>
      </View>

      <Portal>
        <Dialog
          visible={notificationDialogVisible}
          onDismiss={closeNotifications}
        >
          <Dialog.Title>Notifications</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: spacing.md,
                paddingBottom: spacing.sm,
              }}
              style={{ maxHeight: 320 }}
            >
              {notifications.length === 0 ? (
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {loading ? "Loading notifications..." : "You're all caught up!"}
                </Text>
              ) : (
                notifications.map((notification) => (
                  <View
                    key={notification.id}
                    style={{
                      marginBottom: spacing.md,
                      paddingBottom: spacing.sm,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.colors.surfaceVariant,
                    }}
                  >
                    <Text
                      variant="titleSmall"
                      style={{
                        color: theme.colors.onSurface,
                        fontWeight: "600",
                        marginBottom: spacing.xs,
                      }}
                    >
                      {notification.title}
                    </Text>
                    <Text
                      variant="bodyMedium"
                      style={{
                        color: theme.colors.onSurfaceVariant,
                        marginBottom: spacing.sm,
                      }}
                    >
                      {notification.message}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "flex-end",
                      }}
                    >
                      <Button
                        mode="text"
                        style={{ marginRight: spacing.xs }}
                        onPress={() =>
                          void handleDismissNotification(notification.id)
                        }
                        textColor={theme.colors.onSurfaceVariant}
                      >
                        Dismiss
                      </Button>
                      <Button
                        mode="contained"
                        onPress={() => void handleViewNotification(notification)}
                      >
                        View
                      </Button>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          {notifications.length > 1 ? (
            <Dialog.Actions>
              <Button onPress={() => void handleDismissAll()} textColor={theme.colors.primary}>
                Dismiss all
              </Button>
            </Dialog.Actions>
          ) : null}
        </Dialog>
      </Portal>
    </LinearGradient>
  );
}
