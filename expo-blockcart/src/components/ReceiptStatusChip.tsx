import { memo } from "react";
import { Chip, useTheme } from "react-native-paper";
import type { ReceiptStatus } from "../types";

const STATUS_COLORS: Record<ReceiptStatus, string> = {
  pending: "#f59e0b",
  approved: "#22c55e",
  rejected: "#ef4444",
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
  return (
    <Chip
      compact
      style={{
        backgroundColor:
          theme.dark && status === "pending"
            ? theme.colors.surfaceVariant
            : `${STATUS_COLORS[status]}33`,
      }}
      textStyle={{ color: STATUS_COLORS[status], fontWeight: "600" }}
    >
      {STATUS_LABELS[status]}
    </Chip>
  );
}

const ReceiptStatusChip = memo(ReceiptStatusChipComponent);

export default ReceiptStatusChip;
