export type Transaction = {
  id: number;
  transaction_type: "Incoming" | "Outgoing";
  transaction_date: string;
  created_at?: string;
  amount: number;
  category_name: string;
  notes: string;
};
export type User = {
  id: number;
  username: string;
  current_balance: number;
};
export type TransactionInput = {
  type: "Incoming" | "Outgoing";
  amount: number;
  category: string;
  notes: string;
  date: string;
};
