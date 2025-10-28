export type UserRole = "admin" | "reviewer";

export type ReceiptStatus =
  | "pending"
  | "pending_review"
  | "approved"
  | "rejected"
  | "flagged"
  | "error";

export type ReceiptAssignmentStatus = "assigned" | "completed" | "returned";

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  last_login?: string | null;
  wallet_address?: string | null;
  referral_code?: string | null;
  total_rewards?: number;
  referral_count?: number;
  lifetime_tokens?: number;
}

export interface Receipt {
  id: string;
  user_id: string | null;
  user_email?: string | null;
  user_name?: string | null;
  image_url: string;
  total_amount: number;
  store_name?: string | null;
  purchase_date: string;
  status: ReceiptStatus;
  reviewer_id?: string | null;
  reviewer_name?: string | null;
  reviewer_email?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  location?: string | null;
  payment_method?: string | null;
  receipt_time?: string | null;
  reviewed_fields?: Record<string, unknown> | null;
  extracted_fields?: Record<string, unknown> | null;
  assignment_id?: string | null;
  assignment_status?: ReceiptAssignmentStatus | null;
  assigned_at?: string | null;
  assignment_completed_at?: string | null;
}

export interface ReceiptItem {
  name: string;
  brand?: string | null;
  price: number;
}

export interface ReviewedFieldUpdates {
  store?: string | null;
  location?: string | null;
  receipt_date?: string | null;
  receipt_time?: string | null;
  payment_method?: string | null;
  total?: number | null;
  items?: ReceiptItem[] | null;
}

export interface ReceiptReview {
  action: string;
  comment?: string | null;
  created_at: string;
  reviewer?: {
    email: string | null;
  } | null;
}

export interface ReviewerNotificationRecord {
  id: string;
  reviewer_id: string;
  receipt_id: string;
  assignment_id: string;
  created_at: string;
  read_at?: string | null;
  metadata?: Record<string, unknown> | null;
  receipt?: {
    id: string;
    store?: string | null;
    total?: number | string | null;
    receipt_date?: string | null;
    status?: ReceiptStatus | null;
    created_at?: string | null;
    image_url?: string | null;
  } | null;
}

export interface ReviewerNotification {
  id: string;
  reviewer_id: string;
  receipt_id: string;
  assignment_id: string;
  created_at: string;
  read_at: string | null;
  metadata: Record<string, unknown>;
  receipt?: {
    id: string;
    store_name: string | null;
    total_amount: number;
    receipt_date: string | null;
    status: ReceiptStatus | null;
    created_at: string | null;
    image_url: string | null;
  };
}

export type CampaignRewardType = "multiplier" | "fixed_bonus" | "referral_boost";

export interface CampaignRule {
  version?: number | null;
  reward_type?: CampaignRewardType;
  reward_value?: number | null;
  min_spend?: number | null;
  eligible_stores?: string[];
  multiplier_overrides?: {
    double_base?: boolean;
    stack_with_existing?: boolean;
  } | null;
  demographics?: {
    age_min?: number | null;
    age_max?: number | null;
    genders?: string[];
    kyc_verified?: boolean;
  } | null;
  referral?: {
    required?: boolean;
    bonus_amount?: number | null;
  } | null;
  [key: string]: unknown;
}

export interface Campaign {
  id: string;
  brand: string;
  multiplier: number;
  rule_json: CampaignRule | null;
  start_date: string | null;
  end_date: string | null;
  updated_at: string | null;
  version?: number | null;
  name?: string | null;
  description?: string | null;
  reward_amount?: number | null;
  max_participants?: number | null;
  current_participants?: number | null;
  status?: "active" | "inactive" | "completed";
  created_at?: string | null;
}

export interface Reward {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  user_wallet_address?: string | null;
  campaign_id: string;
  campaign_name: string;
  amount: number;
  status: "pending" | "approved" | "paid";
  created_at: string;
  paid_at?: string;
}

export interface Referral {
  id: string;
  referrer: string;
  referrer_email: string;
  referee: string;
  referee_email: string;
  status: "pending" | "completed";
  bonus: number;
  created_at: string;
  updated_at?: string;
}

export interface DashboardStats {
  totalReceipts: number;
  pendingReceipts: number;
  approvedReceipts: number;
  rejectedReceipts: number;
  totalUsers: number;
  activeUsers: number;
  totalRewards: number;
  pendingRewards: number;
}
