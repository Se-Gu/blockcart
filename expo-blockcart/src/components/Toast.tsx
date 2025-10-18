import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useTheme } from "react-native-paper";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  duration?: number;
  onHide: () => void;
  action?: {
    label: string;
    onPress: () => void;
  };
}

const { width: screenWidth } = Dimensions.get("window");

export default function Toast({
  visible,
  message,
  type = "info",
  duration = 4000,
  onHide,
  action,
}: ToastProps) {
  const theme = useTheme();
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Show animation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto hide after duration
      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      hideToast();
    }
  }, [visible, duration]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide();
    });
  };

  const getToastStyles = () => {
    switch (type) {
      case "success":
        return {
          backgroundColor: "#4CAF50",
          borderLeftColor: "#2E7D32",
        };
      case "error":
        return {
          backgroundColor: "#F44336",
          borderLeftColor: "#C62828",
        };
      case "warning":
        return {
          backgroundColor: "#FF9800",
          borderLeftColor: "#F57C00",
        };
      case "info":
      default:
        return {
          backgroundColor: "#2196F3",
          borderLeftColor: "#1565C0",
        };
    }
  };

  const getIcon = () => {
    switch (type) {
      case "success":
        return "✓";
      case "error":
        return "✕";
      case "warning":
        return "⚠";
      case "info":
      default:
        return "ℹ";
    }
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      position: "absolute",
      top: Platform.OS === "ios" ? 60 : 40,
      left: 16,
      right: 16,
      zIndex: 9999,
    },
    toast: {
      borderRadius: 8,
      borderLeftWidth: 4,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
      minHeight: 60,
    },
    content: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      flex: 1,
    },
    icon: {
      fontSize: 20,
      color: theme.colors.onPrimary,
      marginRight: 12,
      fontWeight: "bold",
    },
    message: {
      flex: 1,
      fontSize: 14,
      color: theme.colors.onPrimary,
      fontWeight: "500",
      lineHeight: 20,
    },
    actionButton: {
      marginLeft: 12,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      borderRadius: 4,
    },
    actionText: {
      color: theme.colors.onPrimary,
      fontSize: 12,
      fontWeight: "600",
    },
    closeButton: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 24,
      height: 24,
      justifyContent: "center",
      alignItems: "center",
    },
    closeText: {
      color: theme.colors.onPrimary,
      fontSize: 18,
      fontWeight: "bold",
    },
  });

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        dynamicStyles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <View style={[dynamicStyles.toast, getToastStyles()]}>
        <View style={dynamicStyles.content}>
          <Text style={dynamicStyles.icon}>{getIcon()}</Text>
          <Text style={dynamicStyles.message} numberOfLines={3}>
            {message}
          </Text>
          {action && (
            <TouchableOpacity
              style={dynamicStyles.actionButton}
              onPress={() => {
                action.onPress();
                hideToast();
              }}
            >
              <Text style={dynamicStyles.actionText}>{action.label}</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={dynamicStyles.closeButton} onPress={hideToast}>
          <Text style={dynamicStyles.closeText}>×</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
