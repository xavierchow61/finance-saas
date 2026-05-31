// ============================================================
// 共用 TypeScript 型別定義（對應 Supabase schema）
// ============================================================

export type AccountType = "asset" | "liability" | "expense" | "income";

export interface Account {
  user_id: string;
  code: string;
  name: string;
  account_type: AccountType;
  sub_type: string | null;
  parent_code: string | null;
  opening_balance: number;
  currency: string;
  is_active: boolean;
  sort_order: number;
  color: string | null;
  icon: string | null;
  notes: string | null;
  created_at: string;
}

export interface JournalEntry {
  id: number;
  user_id: string;
  entry_date: string;
  description: string | null;
  invoice_id: number | null;
  project_id: number | null;
  notes: string | null;
  currency: string;
  fx_rate: number;
  created_at: string;
}

export interface JournalLine {
  id: number;
  user_id: string;
  entry_id: number;
  account_code: string;
  debit: number;
  credit: number;
}

// 帶 lines 嘅完整分錄（join 後）
export interface JournalEntryWithLines extends JournalEntry {
  journal_lines: JournalLine[];
}

// 帶餘額嘅帳戶（計算後）
export interface AccountWithBalance extends Account {
  balance: number;
}

// 樹狀分組結果
export interface GroupedAccount {
  account: AccountWithBalance;
  depth: number; // 0 = 父, 1 = 子
  aggregatedBalance: number; // 父 = 自己 + 所有子
  isParent: boolean;
  childCount: number;
}
