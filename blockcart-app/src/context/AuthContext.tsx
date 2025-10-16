import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ExpoLinking from "expo-linking";
import * as Notifications from "expo-notifications";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Alert, Linking as RNLinking } from "react-native";
import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import { supabase } from "../utils/supabase";

type AuthContextType = {
  session: Session | null;
  loading: boolean;
  requestOtp: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SESSION_KEY = "supabase.session";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const handleDeepLink = useCallback(
    async (url: string) => {
      const parsed = ExpoLinking.parse(url);

      const isAuthRedirect =
        url.startsWith(ExpoLinking.createURL("auth")) ||
        parsed.hostname === "auth" ||
        parsed.path?.startsWith("auth");

      if (!isAuthRedirect) {
        return;
      }

      const accessToken = parsed.queryParams?.access_token;
      const refreshToken = parsed.queryParams?.refresh_token;
      const errorDescription = parsed.queryParams?.error_description;

      if (typeof errorDescription === "string" && errorDescription.length) {
        Alert.alert("Login", errorDescription);
        return;
      }

      if (
        typeof accessToken !== "string" ||
        typeof refreshToken !== "string"
      ) {
        return;
      }

      setLoading(true);
      try {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          Alert.alert("Login", error.message);
        }
      } catch (error) {
        console.warn("Failed to handle magic link", error);
        Alert.alert(
          "Login",
          "There was a problem completing the magic link sign-in.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const initialise = async () => {
      try {
        const stored = await AsyncStorage.getItem(SESSION_KEY);
        if (stored) {
          const parsed: Session = JSON.parse(stored);
          setSession(parsed);
          if (parsed.access_token && parsed.refresh_token) {
            await supabase.auth.setSession({
              access_token: parsed.access_token,
              refresh_token: parsed.refresh_token,
            });
          }
        }
        const { data } = await supabase.auth.getSession();
        setSession(data.session);
      } catch (error) {
        console.warn("Failed to restore session", error);
      } finally {
        setLoading(false);
      }
    };

    initialise();

    const subscription = RNLinking.addEventListener("url", ({ url }) => {
      handleDeepLink(url);
    });

    RNLinking.getInitialURL()
      .then((initialUrl) => {
        if (initialUrl) {
          handleDeepLink(initialUrl);
        }
      })
      .catch((error) => {
        console.warn("Unable to get initial URL", error);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        AsyncStorage.setItem(SESSION_KEY, JSON.stringify(newSession)).catch(() =>
          console.warn("Unable to persist Supabase session"),
        );
      } else {
        AsyncStorage.removeItem(SESSION_KEY).catch(() =>
          console.warn("Unable to clear stored session"),
        );
      }
    });

    return () => {
      data.subscription.unsubscribe();
      subscription.remove();
    };
  }, [handleDeepLink]);

  useEffect(() => {
    if (!session?.user) {
      return;
    }

    let channel: RealtimeChannel | null = null;
    let mounted = true;

    const subscribeToReceipts = async () => {
      try {
        await Notifications.requestPermissionsAsync();
      } catch (err) {
        console.warn("Notification permissions error", err);
      }

      channel = supabase
        .channel(`public:receipts:user-${session.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "receipts",
            filter: `user_id=eq.${session.user.id}`,
          },
          (payload) => {
            if (!mounted) return;
            const newStatus = (payload.new as { status?: string } | null)?.status;
            const previousStatus = (payload.old as { status?: string } | null)?.status;
            if (newStatus === "approved" && previousStatus !== "approved") {
              Notifications.scheduleNotificationAsync({
                content: {
                  title: "🎉 Your receipt earned 50 BCT$!",
                  body: "Keep uploading receipts to grow your balance.",
                },
                trigger: null,
              }).catch(() => {
                Alert.alert("Notifications", "Failed to send receipt notification.");
              });
            }
          },
        );
      channel.subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("Failed to subscribe to receipt updates");
        }
      });
    };

    subscribeToReceipts();

    return () => {
      mounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [session?.user?.id]);

  const requestOtp = useCallback(async (email: string) => {
    const redirectTo = ExpoLinking.createURL("auth");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) {
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    await AsyncStorage.removeItem(SESSION_KEY);
  }, []);

  const value = useMemo(
    () => ({
      session,
      loading,
      requestOtp,
      signOut,
    }),
    [loading, requestOtp, session, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
