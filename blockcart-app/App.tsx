import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import React from "react";
import { View } from "react-native";
import {
  ActivityIndicator,
  Provider as PaperProvider,
} from "react-native-paper";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { LoginScreen } from "./src/screens/LoginScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { ReceiptListScreen } from "./src/screens/ReceiptListScreen";
import { WalletScreen } from "./src/screens/WalletScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { UploadReceiptScreen } from "./src/screens/UploadReceiptScreen";
import { ReceiptDetailScreen } from "./src/screens/ReceiptDetailScreen";
import { ReferralScreen } from "./src/screens/ReferralScreen";
import type { RootStackParamList, TabParamList } from "./src/screens/types";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TabNavigator = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: "#2563eb",
      tabBarInactiveTintColor: "#94a3b8",
      tabBarStyle: { backgroundColor: "#ffffff" },
      tabBarIcon: ({ color, size }) => {
        const iconMap: Record<keyof TabParamList, string> = {
          Home: "home-outline",
          Receipts: "receipt-outline",
          Wallet: "wallet-outline",
          Profile: "account-circle-outline",
        };
        const iconName = iconMap[route.name as keyof TabParamList];
        return (
          <MaterialCommunityIcons name={iconName} size={size} color={color} />
        );
      },
    })}
  >
    <Tab.Screen name="Home" component={HomeScreen} />
    <Tab.Screen name="Receipts" component={ReceiptListScreen} />
    <Tab.Screen name="Wallet" component={WalletScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

const RootNavigator = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack.Navigator>
      {session ? (
        <>
          <Stack.Screen
            name="Main"
            component={TabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="UploadReceipt"
            component={UploadReceiptScreen}
            options={{ title: "Upload Receipt" }}
          />
          <Stack.Screen
            name="ReceiptDetail"
            component={ReceiptDetailScreen}
            options={{ title: "Receipt Detail" }}
          />
          <Stack.Screen
            name="Referral"
            component={ReferralScreen}
            options={{ title: "Referrals & Bonuses" }}
          />
        </>
      ) : (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      )}
    </Stack.Navigator>
  );
};

export default function App() {
  return (
    <PaperProvider>
      <AuthProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </PaperProvider>
  );
}
