"use client";

import { memo } from "react";
import { Chip, useTheme } from "react-native-paper";
import type { ReceiptStatus } from "../types";
import { colors } from "../theme/colors";

const STATUS_COLORS: Record<ReceiptStatus, string> = {
  pending: colors.pending,
  approved: colors.approved,
  rejected: colors.error,
};

const STATUS_LABELS: Record<ReceiptStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

type Props = {
  status: ReceiptStatus;
};

function ReceiptStatusChipComponent({ status }: Props) {
  const theme = useTheme();
  const statusColor = STATUS_COLORS[status];

  return (
    <Chip
      compact
      style={{
        backgroundColor: `${statusColor}20`,
        borderWidth: 1,
        borderColor: `${statusColor}40`,
      }}
      textStyle={{
        color: theme.dark ? statusColor : statusColor,
        fontWeight: "600",
        fontSize: 12,
      }}
    >
      {STATUS_LABELS[status]}
    </Chip>
  );
}

const ReceiptStatusChip = memo(ReceiptStatusChipComponent);

export default ReceiptStatusChip;
