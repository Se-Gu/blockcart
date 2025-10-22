export type ReceiptStatus =
  | "pending"
  | "pending_review"
  | "approved"
  | "rejected"
  | "flagged"
  | "error";

export type ReceiptItem = {
  name?: string | null;
  brand?: string | null;
  price?: number | null;
  quantity?: number | null;
  [key: string]: unknown;
};

export type ReceiptExtractedFields = {
  store?: string | null;
  location?: string | null;
  date?: string | null;
  time?: string | null;
  payment_method?: string | null;
  total?: number | null;
  items?: ReceiptItem[] | null;
  [key: string]: unknown;
};

export type Receipt = {
  id: string;
  user_id?: string;
  created_at: string;
  updated_at?: string;
  image_url?: string | null;
  store: string | null; // Changed from store_name to match schema
  total: number | null;
  status: ReceiptStatus;
  parsed_json?: Record<string, unknown> | null; // legacy field
  extracted_fields?: ReceiptExtractedFields | null;
  reward_amount?: number | null;
  receipt_date?: string | null;
  receipt_time?: string | null;
  location?: string | null;
  payment_method?: string | null;
  rejection_reason?: string | null;
  reviewed_fields?: Record<string, unknown> | null;
  moderation_result?: Record<string, unknown> | null;
};

export type Reward = {
  id: string;
  user_id?: string;
  amount: number;
  created_at: string;
  description?: string | null;
  receipt_id?: string | null;
};

export type UserBalance = {
  user_id: string;
  total_balance: number | null;
};

export type Profile = {
  id?: string;
  email?: string | null;
  referral_code?: string | null;
  referred_by?: string | null;
  age?: number | null;
  sex?: string | null;
  kyc_age?: number | null;
  kyc_sex?: string | null;
  bonus_total?: number | null;
};
