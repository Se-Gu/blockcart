import { View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";

type Props = {
  message?: string;
};

export default function LoadingView({ message }: Props) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <ActivityIndicator size="large" />
      {message ? (
        <Text style={{ marginTop: 16, textAlign: "center" }}>{message}</Text>
      ) : null}
    </View>
  );
}
