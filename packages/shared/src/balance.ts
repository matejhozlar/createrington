export const BALANCE_TRANSACTION_TYPES = [
  "transfer_send",
  "transfer_receive",
  "deposit",
  "withdraw",
  "admin_grant",
  "admin_deduct",
  "admin_set",
  "purchase",
  "reward",
  "refund",
  "gallery_reward",
  "lottery_entry",
  "lottery_win",
  "lottery_refund",
] as const;

export type BalanceTransactionType = (typeof BALANCE_TRANSACTION_TYPES)[number];
