import type { Receipt } from "../types";

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  UploadReceipt: undefined;
  ReceiptDetail: { receiptId: string; initialReceipt?: Receipt };
  Referral: undefined;
};

export type TabParamList = {
  Home: undefined;
  Receipts: undefined;
  Wallet: undefined;
  Profile: undefined;
};
