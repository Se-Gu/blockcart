export type UserRole = "admin" | "reviewer"

export type ReceiptStatus =
  | "pending"
  | "pending_review"
  | "approved"
  | "rejected"
  | "flagged"
  | "error"

export interface User {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  created_at: string
  last_login?: string | null
  wallet_address?: string | null
  referral_code?: string | null
  total_rewards?: number
  referral_count?: number
  lifetime_tokens?: number
}

export interface Receipt {
  id: string
  user_id: string | null
  user_email?: string | null
  user_name?: string | null
  image_url: string
  total_amount: number
  store_name?: string | null
  purchase_date: string
  status: ReceiptStatus
  reviewer_id?: string | null
  reviewer_name?: string | null
  reviewer_email?: string | null
  reviewed_at?: string | null
  rejection_reason?: string | null
  created_at: string
  location?: string | null
  payment_method?: string | null
  receipt_time?: string | null
  reviewed_fields?: Record<string, unknown> | null
  extracted_fields?: Record<string, unknown> | null
}

export interface ReviewedFieldUpdates {
  store?: string | null
  location?: string | null
  receipt_date?: string | null
  receipt_time?: string | null
  payment_method?: string | null
  total?: number | null
}

export interface Campaign {
  id: string
  brand: string
  multiplier: number
  rule_json: Record<string, unknown> | null
  start_date: string | null
  end_date: string | null
  updated_at: string | null
  version?: number | null
  name?: string | null
  description?: string | null
  reward_amount?: number | null
  max_participants?: number | null
  current_participants?: number | null
  status?: "active" | "inactive" | "completed"
  created_at?: string | null
}

export interface Reward {
  id: string
  user_id: string
  user_email: string
  user_name: string
  campaign_id: string
  campaign_name: string
  amount: number
  status: "pending" | "approved" | "paid"
  created_at: string
  paid_at?: string
}

export interface Referral {
  id: string
  referrer_id: string
  referrer_email: string
  referee_id: string
  referee_email: string
  status: "pending" | "completed"
  reward_amount: number
  created_at: string
  completed_at?: string
}

export interface DashboardStats {
  totalReceipts: number
  pendingReceipts: number
  approvedReceipts: number
  rejectedReceipts: number
  totalUsers: number
  activeUsers: number
  totalRewards: number
  pendingRewards: number
}
