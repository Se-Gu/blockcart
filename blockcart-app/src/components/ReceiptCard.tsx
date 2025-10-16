import React from "react";
import { View } from "react-native";
import { Card, Chip, Text } from "react-native-paper";
import { formatCurrency, formatDate } from "../utils/format";
import type { Receipt } from "../types";

type ReceiptCardProps = {
  receipt: Receipt;
  onPress?: () => void;
};

const statusColor: Record<Receipt["status"], string> = {
  pending: "#fbbf24",
  approved: "#22c55e",
  rejected: "#ef4444",
};

const statusLabel: Record<Receipt["status"], string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export const ReceiptCard: React.FC<ReceiptCardProps> = ({ receipt, onPress }) => {
  return (
    <Card onPress={onPress} style={{ marginBottom: 12 }} mode="elevated">
      <Card.Content>
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text variant="titleMedium" style={{ color: "#0f172a" }}>
              {receipt.store_name?.trim() || "Pending OCR"}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: "#64748b", marginTop: 4 }}
            >
              {formatDate(receipt.created_at)}
            </Text>
          </View>
          <Text variant="titleMedium" style={{ color: "#0f172a" }}>
            {formatCurrency(receipt.total)}
          </Text>
        </View>
        <View className="mt-3">
          <Chip
            style={{ alignSelf: "flex-start", backgroundColor: statusColor[receipt.status] }}
            textStyle={{ color: "#0f172a", fontWeight: "600" }}
          >
            {statusLabel[receipt.status]}
          </Chip>
        </View>
      </Card.Content>
    </Card>
  );
};
