"use client"

import "react-native-gesture-handler"
import "./polyfills"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AppState, type AppStateStatus, Platform, useColorScheme } from "react-native"
import {
  NavigationContainer,
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
} from "@react-navigation/native"
import { MD3DarkTheme, MD3LightTheme, Provider as PaperProvider, adaptNavigationTheme } from "react-native-paper"
import * as Notifications from "expo-notifications"
import type { RealtimePostgresChangesPayload, Session } from "@supabase/supabase-js"
import { SafeAreaProvider } from "react-native-safe-area-context"
import MainNavigator from "./navigation/MainNavigator"
import LoginScreen from "./screens/LoginScreen"
import { supabase } from "./lib/supabase"
import { AuthContext } from "./context/AuthContext"
import { NotificationsProvider } from "./context/NotificationsContext"
import LoadingView from "./components/LoadingView"
import { ToastProvider } from "./components/ToastProvider"
import type { Receipt, ReviewNotification } from "./types"
import { colors } from "./theme/colors"

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

const { LightTheme: navLightTheme, DarkTheme: navDarkTheme } = adaptNavigationTheme({
  reactNavigationLight: NavigationDefaultTheme,
  reactNavigationDark: NavigationDarkTheme,
})

const customLightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    primaryContainer: colors.primaryLight,
    secondary: colors.accent,
    secondaryContainer: colors.accentLight,
    background: colors.background,
    surface: colors.surface,
    surfaceVariant: colors.surfaceVariant,
    error: colors.error,
    errorContainer: colors.errorLight,
    onPrimary: "#FFFFFF",
    onSecondary: "#FFFFFF",
    onBackground: colors.textPrimary,
    onSurface: colors.textPrimary,
    onSurfaceVariant: colors.textSecondary,
    outline: colors.textTertiary,
    outlineVariant: colors.surfaceVariant,
  },
}

const customDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: colors.primaryLight,
    primaryContainer: colors.primaryDark,
    secondary: colors.accentLight,
    secondaryContainer: colors.accentDark,
    background: colors.backgroundDark,
    surface: colors.surfaceDark,
    surfaceVariant: colors.surfaceVariantDark,
    error: colors.errorDark,
    errorContainer: colors.errorLight,
    onPrimary: colors.backgroundDark,
    onSecondary: colors.backgroundDark,
    onBackground: colors.textPrimaryDark,
    onSurface: colors.textPrimaryDark,
    onSurfaceVariant: colors.textSecondaryDark,
    outline: colors.textTertiaryDark,
    outlineVariant: colors.surfaceVariantDark,
    elevation: {
      level0: colors.surfaceDark,
      level1: colors.surfaceElevatedDark,
      level2: "#2A2A2A",
      level3: "#2F2F2F",
      level4: "#333333",
      level5: "#383838",
    },
  },
}

export default function App() {
  const colorScheme = useColorScheme()
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    const setupSession = async () => {
      const {
        data: { session: activeSession },
      } = await supabase.auth.getSession()
      setSession(activeSession)
      setInitializing(false)
    }

    void setupSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const handleAppStateChange = (state: AppStateStatus) => {
      if (state === "active") {
        supabase.auth.startAutoRefresh()
      } else {
        supabase.auth.stopAutoRefresh()
      }
    }

    const subscription = AppState.addEventListener("change", handleAppStateChange)
    return () => {
      subscription.remove()
    }
  }, [])

  useEffect(() => {
    const configureNotifications = async () => {
      const { status } = await Notifications.getPermissionsAsync()
      if (status !== "granted") {
        await Notifications.requestPermissionsAsync()
      }

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.DEFAULT,
        })
      }
    }

    void configureNotifications()
  }, [])

  useEffect(() => {
    if (!session?.user) {
      return
    }

    const receiptsChannel = supabase
      .channel(`receipts-updates-${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "receipts",
          filter: `reviewer_id=eq.${session.user.id}`,
        },
        async (payload: RealtimePostgresChangesPayload<Receipt>) => {
          const newRow = (payload.new ?? {}) as Partial<Receipt>
          const oldRow = (payload.old ?? {}) as Partial<Receipt>
          const newStatus = newRow.status
          const oldStatus = oldRow.status

          if (newStatus === "approved" && oldStatus !== "approved") {
            const rewardAmount = newRow.reward_amount
            const rewardText = rewardAmount && rewardAmount > 0 ? ` ${rewardAmount.toFixed(2)} BTC$!` : "!"

            await Notifications.scheduleNotificationAsync({
              content: {
                title: "🎉 Your receipt earned BTC$!",
                body: `Your receipt was approved${rewardText}`,
              },
              trigger: null,
            })
          }
        },
      )
      .subscribe()

    const reviewNotificationsChannel = supabase
      .channel(`review-notifications-alerts-${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reviewer_notifications",
          filter: `reviewer_id=eq.${session.user.id}`,
        },
        async (payload: RealtimePostgresChangesPayload<ReviewNotification>) => {
          const notification = payload.new as ReviewNotification | null
          if (!notification) {
            return
          }

          await Notifications.scheduleNotificationAsync({
            content: {
              title: notification.title || "Receipt update",
              body: notification.message,
            },
            trigger: null,
          })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(receiptsChannel)
      void supabase.removeChannel(reviewNotificationsChannel)
    }
  }, [session])

  const paperTheme = colorScheme === "dark" ? customDarkTheme : customLightTheme
  const navigationTheme = colorScheme === "dark" ? navDarkTheme : navLightTheme

  const refreshSession = useCallback(async () => {
    const {
      data: { session: refreshed },
    } = await supabase.auth.getSession()
    setSession(refreshed)
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
  }, [])

  const authContextValue = useMemo(
    () => ({
      session,
      refreshSession,
      signOut,
    }),
    [refreshSession, session, signOut],
  )

  if (initializing) {
    return (
      <PaperProvider theme={paperTheme}>
        <LoadingView message="Preparing Blockcart" />
      </PaperProvider>
    )
  }

  return (
    <PaperProvider theme={paperTheme}>
      <SafeAreaProvider>
        <ToastProvider>
          <AuthContext.Provider value={authContextValue}>
            <NotificationsProvider>
              <NavigationContainer theme={navigationTheme}>
                {session ? <MainNavigator /> : <LoginScreen />}
              </NavigationContainer>
            </NotificationsProvider>
          </AuthContext.Provider>
        </ToastProvider>
      </SafeAreaProvider>
    </PaperProvider>
  )
}
