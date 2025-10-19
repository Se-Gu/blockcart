export type UserRole = "admin" | "reviewer"

export type ReceiptStatus = "pending" | "approved" | "rejected"

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  created_at: string
  last_login?: string
}

export interface Receipt {
  id: string
  user_id: string
  user_email: string
  user_name: string
  image_url: string
  total_amount: number
  store_name: string
  purchase_date: string
  status: ReceiptStatus
  reviewer_id?: string
  reviewer_name?: string
  reviewed_at?: string
  rejection_reason?: string
  created_at: string
}

export interface Campaign {
  id: string
  name: string
  description: string
  start_date: string
  end_date: string
  reward_amount: number
  max_participants?: number
  current_participants: number
  status: "active" | "inactive" | "completed"
  created_at: string
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
