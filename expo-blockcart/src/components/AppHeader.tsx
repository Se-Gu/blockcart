"use client";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { IconButton, Menu, Text, useTheme } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "../theme/colors";
import { useAuth } from "../context/AuthContext";

interface AppHeaderProps {
  title?: string;
  canGoBack?: boolean;
  onBackPress?: () => void;
  onNavigateToProfile?: () => void;
}

export default function AppHeader({
  title,
  canGoBack,
  onBackPress,
  onNavigateToProfile,
}: AppHeaderProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);

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
    </LinearGradient>
  );
}
