import type { AccountType } from "./types";

// ============================================================
// 帳戶類型
// ============================================================
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  asset: "💰 資產",
  liability: "💳 負債",
  expense: "🛒 支出",
  income: "💼 收入",
};

export const ACCOUNT_TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: "asset", label: "💰 資產（現金/銀行/投資）" },
  { value: "liability", label: "💳 負債（信用卡/貸款）" },
  { value: "expense", label: "🛒 支出類別" },
  { value: "income", label: "💼 收入類別" },
];

// ============================================================
// 子分類（依 account_type）
// ============================================================
export const ACCOUNT_SUB_TYPES: Record<AccountType, string[]> = {
  asset: ["現金", "銀行", "投資", "應收戶口", "其他資產"],
  liability: ["信用卡", "個人貸款", "應付款", "其他負債"],
  expense: [],
  income: [],
};

// ============================================================
// 幣別
// ============================================================
export const CURRENCIES = [
  "HKD",
  "USD",
  "JPY",
  "CNY",
  "EUR",
  "GBP",
  "AUD",
  "SGD",
  "TWD",
];

// ============================================================
// 預設帳戶（seed）
// ============================================================
export interface SeedAccount {
  code: string;
  name: string;
  account_type: AccountType;
  sub_type?: string;
  icon?: string;
  sort_order: number;
}

export const DEFAULT_ACCOUNTS: SeedAccount[] = [
  // === 資產 ===
  { code: "CASH", name: "現金", account_type: "asset", sub_type: "現金", icon: "💵", sort_order: 1 },
  { code: "BANK", name: "銀行存款", account_type: "asset", sub_type: "銀行", icon: "🏦", sort_order: 2 },
  { code: "OCTOPUS", name: "八達通", account_type: "asset", sub_type: "現金", icon: "🚇", sort_order: 3 },
  { code: "ALIPAY", name: "支付寶", account_type: "asset", sub_type: "現金", icon: "📱", sort_order: 4 },
  { code: "PAYME", name: "PayMe", account_type: "asset", sub_type: "現金", icon: "📲", sort_order: 5 },
  { code: "AR_REIMBURSE", name: "公司報銷應收", account_type: "asset", sub_type: "應收戶口", icon: "🏢", sort_order: 9 },

  // === 負債 ===
  { code: "CREDIT_CARD", name: "信用卡", account_type: "liability", sub_type: "信用卡", icon: "💳", sort_order: 1 },

  // === 支出 ===
  { code: "FOOD", name: "餐飲", account_type: "expense", icon: "🍱", sort_order: 10 },
  { code: "GROCERY", name: "超市雜貨", account_type: "expense", icon: "🛒", sort_order: 20 },
  { code: "TRANSPORT", name: "交通", account_type: "expense", icon: "🚇", sort_order: 30 },
  { code: "CLOTHING", name: "服飾", account_type: "expense", icon: "👔", sort_order: 40 },
  { code: "ELECTRONICS", name: "電子產品", account_type: "expense", icon: "📱", sort_order: 50 },
  { code: "BEAUTY", name: "美容護理", account_type: "expense", icon: "💄", sort_order: 60 },
  { code: "MEDICAL", name: "醫療藥物", account_type: "expense", icon: "💊", sort_order: 70 },
  { code: "ENTERTAINMENT", name: "娛樂", account_type: "expense", icon: "🎬", sort_order: 80 },
  { code: "HOUSEHOLD", name: "家居用品", account_type: "expense", icon: "🏠", sort_order: 90 },
  { code: "EDUCATION", name: "教育學習", account_type: "expense", icon: "📚", sort_order: 100 },
  { code: "TRAVEL", name: "住宿旅遊", account_type: "expense", icon: "✈️", sort_order: 110 },
  { code: "TELECOM", name: "通訊網絡", account_type: "expense", icon: "📶", sort_order: 120 },
  { code: "UTILITIES", name: "水電煤", account_type: "expense", icon: "💡", sort_order: 130 },
  { code: "INSURANCE", name: "保險", account_type: "expense", icon: "🛡️", sort_order: 140 },
  { code: "OTHER_EXPENSE", name: "其他支出", account_type: "expense", icon: "📦", sort_order: 200 },

  // === 收入 ===
  { code: "SALARY", name: "薪金", account_type: "income", icon: "💼", sort_order: 1 },
  { code: "BONUS", name: "紅利", account_type: "income", icon: "🎁", sort_order: 2 },
  { code: "INVESTMENT_INCOME", name: "投資收益", account_type: "income", icon: "📈", sort_order: 3 },
  { code: "OTHER_INCOME", name: "其他收入", account_type: "income", icon: "💰", sort_order: 9 },
];

// ============================================================
// 導航 menu
// ============================================================
export const NAV_ITEMS = [
  { href: "/dashboard", label: "儀表板", icon: "🏠" },
  { href: "/accounts", label: "帳戶管理", icon: "🏦" },
  { href: "/ledger", label: "個人記賬", icon: "💰" },
] as const;
