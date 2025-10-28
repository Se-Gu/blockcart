"use client"

import { memo } from "react"
import { Chip, useTheme } from "react-native-paper"
import type { ReceiptStatus } from "../types"
import { colors } from "../theme/colors"

const STATUS_COLORS_LIGHT: Record<ReceiptStatus, { bg: string; text: string; border: string }> = {
  pending: {
    bg: `${colors.pending}25`,
    text: colors.pending,
    border: `${colors.pending}60`,
  },
  pending_review: {
    bg: `${colors.pendingReview}25`,
    text: colors.pendingReview,
    border: `${colors.pendingReview}60`,
  },
  approved: {
    bg: `${colors.approved}25`,
    text: colors.approved,
    border: `${colors.approved}60`,
  },
  rejected: {
    bg: `${colors.rejected}25`,
    text: colors.rejected,
    border: `${colors.rejected}60`,
  },
  flagged: {
    bg: `${colors.flagged}25`,
    text: colors.flagged,
    border: `${colors.flagged}60`,
  },
  error: {
    bg: `${colors.error}25`,
    text: colors.error,
    border: `${colors.error}60`,
  },
}

const STATUS_COLORS_DARK: Record<ReceiptStatus, { bg: string; text: string; border: string }> = {
  pending: {
    bg: `${colors.pendingDark}30`,
    text: colors.warningLight,
    border: `${colors.pendingDark}70`,
  },
  pending_review: {
    bg: `${colors.pendingReviewDark}30`,
    text: colors.infoLight,
    border: `${colors.pendingReviewDark}70`,
  },
  approved: {
    bg: `${colors.approvedDark}30`,
    text: colors.successLight,
    border: `${colors.approvedDark}70`,
  },
  rejected: {
    bg: `${colors.rejectedDark}30`,
    text: colors.errorLight,
    border: `${colors.rejectedDark}70`,
  },
  flagged: {
    bg: `${colors.flaggedDark}30`,
    text: colors.errorLight,
    border: `${colors.flaggedDark}70`,
  },
  error: {
    bg: `${colors.errorDark}30`,
    text: colors.errorLight,
    border: `${colors.errorDark}70`,
  },
}

const STATUS_LABELS: Record<ReceiptStatus, string> = {
  pending: "Queued",
  pending_review: "In Review",
  approved: "Approved",
  rejected: "Rejected",
  flagged: "Flagged",
  error: "Error",
}

const STATUS_ICONS: Record<ReceiptStatus, string> = {
  pending: "clock-outline",
  pending_review: "eye-outline",
  approved: "check-circle",
  rejected: "close-circle",
  flagged: "flag",
  error: "alert-circle",
}

type Props = {
  status: ReceiptStatus
  showIcon?: boolean
}

function ReceiptStatusChipComponent({ status, showIcon = true }: Props) {
  const theme = useTheme()
  const isDark = theme.dark
  const statusColors = isDark ? STATUS_COLORS_DARK[status] : STATUS_COLORS_LIGHT[status]

  return (
    <Chip
      compact
      icon={showIcon ? STATUS_ICONS[status] : undefined}
      style={{
        backgroundColor: statusColors.bg,
        borderWidth: 1.5,
        borderColor: statusColors.border,
      }}
      textStyle={{
        color: statusColors.text,
        fontWeight: "600",
        fontSize: 12,
        letterSpacing: 0.3,
      }}
    >
      {STATUS_LABELS[status]}
    </Chip>
  )
}

const ReceiptStatusChip = memo(ReceiptStatusChipComponent)

export default ReceiptStatusChip
