"use client";

import { memo } from "react";
import { Chip, useTheme } from "react-native-paper";
import type { ReceiptStatus } from "../types";
import { colors } from "../theme/colors";

const STATUS_COLORS: Record<ReceiptStatus, string> = {
  pending: colors.pending,
  pending_review: colors.pendingReview,
  approved: colors.approved,
  rejected: colors.error,
  flagged: colors.flagged,
  error: colors.error,
};

const STATUS_LABELS: Record<ReceiptStatus, string> = {
  pending: "Queued",
  pending_review: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
  flagged: "Flagged",
  error: "Error",
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
        borderColor: `${statusColor}50`,
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
