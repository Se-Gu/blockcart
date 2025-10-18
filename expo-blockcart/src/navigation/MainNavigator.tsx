import { MaterialCommunityIcons } from "@expo/vector-icons";
import { NavigatorScreenParams, ParamListBase } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTheme } from "react-native-paper";
import HomeScreen from "../screens/HomeScreen";
import ReceiptListScreen from "../screens/ReceiptListScreen";
import ReceiptDetailScreen from "../screens/ReceiptDetailScreen";
import UploadReceiptScreen from "../screens/UploadReceiptScreen";
import WalletScreen from "../screens/WalletScreen";
import ProfileScreen from "../screens/ProfileScreen";
import ReferralScreen from "../screens/ReferralScreen";
import AppHeader from "../components/AppHeader";

export type ReceiptsStackParamList = {
  ReceiptList: undefined;
  ReceiptDetail: { receiptId: string };
  UploadReceipt: undefined;
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  Referral: undefined;
};

export type AppTabParamList = {
  Home: undefined;
  Receipts: NavigatorScreenParams<ReceiptsStackParamList> | undefined;
  Wallet: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

const Tab = createBottomTabNavigator<AppTabParamList>();
const ReceiptsStack = createNativeStackNavigator<ReceiptsStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

type ScreenOptions = {
  title: string;
  tabBarIcon: IconName;
};

const tabScreenOptions: Record<keyof AppTabParamList, ScreenOptions> = {
  Home: { title: "Home", tabBarIcon: "home-variant" },
  Receipts: { title: "Receipts", tabBarIcon: "receipt" },
  Wallet: { title: "Wallet", tabBarIcon: "wallet" },
  Profile: { title: "Profile", tabBarIcon: "account" },
};

function ReceiptsStackNavigator() {
  return (
    <ReceiptsStack.Navigator screenOptions={{ headerShown: false }}>
      <ReceiptsStack.Screen name="ReceiptList" component={ReceiptListScreen} />
      <ReceiptsStack.Screen
        name="ReceiptDetail"
        component={ReceiptDetailScreen}
        options={{ title: "Receipt Detail" }}
      />
      <ReceiptsStack.Screen
        name="UploadReceipt"
        component={UploadReceiptScreen}
        options={{ title: "Upload Receipt" }}
      />
    </ReceiptsStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen
        name="Referral"
        component={ReferralScreen}
        options={{ title: "Referrals & Bonuses" }}
      />
    </ProfileStack.Navigator>
  );
}

export default function MainNavigator() {
  const theme = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        header: () => (
          <AppHeader
            title={tabScreenOptions[route.name as keyof AppTabParamList].title}
          />
        ),
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.outline,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
        },
        tabBarIcon: ({ color, size }) => {
          const config = tabScreenOptions[route.name as keyof AppTabParamList];
          return (
            <MaterialCommunityIcons
              name={config.tabBarIcon}
              color={color}
              size={size}
            />
          );
        },
        title: tabScreenOptions[route.name as keyof AppTabParamList].title,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Receipts" component={ReceiptsStackNavigator} />
      <Tab.Screen name="Wallet" component={WalletScreen} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
}

export type CompositeTabParamList = ParamListBase & AppTabParamList;
