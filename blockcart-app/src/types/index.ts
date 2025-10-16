export type ReceiptStatus = "pending" | "approved" | "rejected";

export type Receipt = {
  id: string;
  user_id: string;
  store_name: string | null;
  total: number | null;
  status: ReceiptStatus;
  created_at: string;
  parsed_json: Record<string, unknown> | null;
  image_url?: string | null;
};

export type Reward = {
  id: string;
  user_id: string;
  receipt_id?: string | null;
  amount: number;
  created_at: string;
  description?: string | null;
};

export type UserProfile = {
  id: string;
  email: string;
  referral_code?: string | null;
  referred_by?: string | null;
  kyc_age?: number | null;
  kyc_sex?: string | null;
};
