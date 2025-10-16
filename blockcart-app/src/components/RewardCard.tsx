import React from "react";
import { View } from "react-native";
import { Card, Text } from "react-native-paper";
import { formatCurrency, formatDate } from "../utils/format";
import type { Reward } from "../types";

type RewardCardProps = {
  reward: Reward;
};

export const RewardCard: React.FC<RewardCardProps> = ({ reward }) => {
  const isCredit = reward.amount >= 0;
  return (
    <Card mode="outlined" style={{ marginBottom: 12 }}>
      <Card.Content>
        <View className="flex-row items-center justify-between">
          <View>
            <Text variant="titleMedium" style={{ color: "#0f172a" }}>
              {reward.description || (isCredit ? "Reward" : "Debit")}
            </Text>
            <Text variant="bodySmall" style={{ color: "#64748b", marginTop: 4 }}>
              {formatDate(reward.created_at)}
            </Text>
          </View>
          <Text
            variant="titleMedium"
            style={{ color: isCredit ? "#10b981" : "#f43f5e" }}
          >
            {`${isCredit ? "+" : "-"}${formatCurrency(Math.abs(reward.amount))}`}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
};
