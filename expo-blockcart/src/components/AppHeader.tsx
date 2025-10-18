import { View } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface AppHeaderProps {
  title?: string;
}

export default function AppHeader({ title }: AppHeaderProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.colors.primary,
        paddingTop: 16,
        paddingBottom: 16,
        paddingHorizontal: 16,
        alignItems: "center",
        justifyContent: "center",
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.primaryContainer,
      }}
    >
      <Text
        variant="headlineSmall"
        style={{
          color: theme.colors.onPrimary,
          fontWeight: "bold",
          textAlign: "center",
        }}
      >
        {title || "BlockCart"}
      </Text>
    </View>
  );
}
r;
