import type {
  Account,
  AccountType,
  AccountWithBalance,
  GroupedAccount,
  JournalLine,
} from "./types";

// ============================================================
// 帳戶餘額計算（雙式記賬）
// ============================================================
// asset / expense：正常餘額在借方 → opening + Σdebit − Σcredit
// liability / income：正常餘額在貸方 → opening + Σcredit − Σdebit
// ============================================================

export function computeBalance(
  accountType: AccountType,
  openingBalance: number,
  totalDebit: number,
  totalCredit: number,
): number {
  const opening = openingBalance || 0;
  if (accountType === "asset" || accountType === "expense") {
    return opening + totalDebit - totalCredit;
  }
  return opening + totalCredit - totalDebit;
}

/**
 * 由 accounts + 所有 journal_lines 計算每個帳戶餘額
 */
export function calcAccountBalances(
  accounts: Account[],
  lines: Pick<JournalLine, "account_code" | "debit" | "credit">[],
): AccountWithBalance[] {
  // 累加每個 account_code 嘅 debit / credit
  const drMap = new Map<string, number>();
  const crMap = new Map<string, number>();
  for (const l of lines) {
    drMap.set(l.account_code, (drMap.get(l.account_code) || 0) + (l.debit || 0));
    crMap.set(
      l.account_code,
      (crMap.get(l.account_code) || 0) + (l.credit || 0),
    );
  }

  return accounts.map((a) => ({
    ...a,
    balance: computeBalance(
      a.account_type,
      a.opening_balance,
      drMap.get(a.code) || 0,
      crMap.get(a.code) || 0,
    ),
  }));
}

// ============================================================
// 樹狀分組 + 父帳戶合計
// ============================================================
export function groupAccountsWithParentTotals(
  accounts: AccountWithBalance[],
): GroupedAccount[] {
  const codeSet = new Set(accounts.map((a) => a.code));

  const topLevel = accounts.filter(
    (a) => !a.parent_code || !codeSet.has(a.parent_code),
  );
  const childrenOf = new Map<string, AccountWithBalance[]>();
  for (const a of accounts) {
    if (a.parent_code && codeSet.has(a.parent_code)) {
      const arr = childrenOf.get(a.parent_code) || [];
      arr.push(a);
      childrenOf.set(a.parent_code, arr);
    }
  }

  // 排序頂層
  topLevel.sort(
    (x, y) =>
      x.account_type.localeCompare(y.account_type) ||
      (x.sort_order || 0) - (y.sort_order || 0) ||
      x.name.localeCompare(y.name),
  );

  const result: GroupedAccount[] = [];
  for (const parent of topLevel) {
    const children = (childrenOf.get(parent.code) || []).sort(
      (x, y) => (x.sort_order || 0) - (y.sort_order || 0) || x.name.localeCompare(y.name),
    );
    const childrenTotal = children.reduce((s, c) => s + (c.balance || 0), 0);
    result.push({
      account: parent,
      depth: 0,
      aggregatedBalance: (parent.balance || 0) + childrenTotal,
      isParent: children.length > 0,
      childCount: children.length,
    });
    for (const child of children) {
      result.push({
        account: child,
        depth: 1,
        aggregatedBalance: child.balance || 0,
        isParent: false,
        childCount: 0,
      });
    }
  }
  return result;
}

// ============================================================
// 格式化金額（永遠 2 位小數）
// ============================================================
export function fmtMoney(n: number, currency = "HKD"): string {
  const v = (n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === "HKD" ? `$${v}` : `${currency} ${v}`;
}

// ============================================================
// 期間日期計算（YYYY-MM → start / end）
// ============================================================
export function monthRange(period: string): { start: string; end: string } {
  // period = 'YYYY-MM'
  const [y, m] = period.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate(); // m 月最後一日
  const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ============================================================
// 收支表（P&L）— 由 entries（帶日期）+ lines + accounts 計算
// ============================================================
export interface PnlRow {
  code: string;
  name: string;
  icon: string | null;
  amount: number; // income: cr-dr; expense: dr-cr
}

export interface IncomeStatement {
  income: PnlRow[];
  expense: PnlRow[];
  totalIncome: number;
  totalExpense: number;
  net: number;
}

interface LineWithDate {
  account_code: string;
  debit: number;
  credit: number;
  entry_date: string;
}

export function incomeStatement(
  accounts: { code: string; name: string; icon: string | null; account_type: string }[],
  lines: LineWithDate[],
  start: string,
  end: string,
): IncomeStatement {
  const accMap = new Map(accounts.map((a) => [a.code, a]));
  // 累加期間內 lines
  const dr = new Map<string, number>();
  const cr = new Map<string, number>();
  for (const l of lines) {
    if (l.entry_date < start || l.entry_date > end) continue;
    dr.set(l.account_code, (dr.get(l.account_code) || 0) + (l.debit || 0));
    cr.set(l.account_code, (cr.get(l.account_code) || 0) + (l.credit || 0));
  }

  const income: PnlRow[] = [];
  const expense: PnlRow[] = [];
  for (const a of accounts) {
    const d = dr.get(a.code) || 0;
    const c = cr.get(a.code) || 0;
    if (a.account_type === "income") {
      const amt = c - d;
      if (Math.abs(amt) > 0.005)
        income.push({ code: a.code, name: a.name, icon: a.icon, amount: amt });
    } else if (a.account_type === "expense") {
      const amt = d - c;
      if (Math.abs(amt) > 0.005)
        expense.push({ code: a.code, name: a.name, icon: a.icon, amount: amt });
    }
  }
  void accMap; // (保留 map 以便未來擴充)
  income.sort((a, b) => b.amount - a.amount);
  expense.sort((a, b) => b.amount - a.amount);
  const totalIncome = income.reduce((s, r) => s + r.amount, 0);
  const totalExpense = expense.reduce((s, r) => s + r.amount, 0);
  return {
    income,
    expense,
    totalIncome,
    totalExpense,
    net: totalIncome - totalExpense,
  };
}

// ============================================================
// 預算 vs 實績
// ============================================================
export interface BudgetRow {
  code: string;
  name: string;
  icon: string | null;
  budget: number | null;
  actual: number;
  remaining: number | null;
  pctUsed: number | null;
}

export function budgetVsActual(
  expenseAccounts: { code: string; name: string; icon: string | null }[],
  budgets: { account_code: string; amount: number }[],
  expenseRows: PnlRow[],
): BudgetRow[] {
  const budgetMap = new Map(budgets.map((b) => [b.account_code, b.amount]));
  const actualMap = new Map(expenseRows.map((r) => [r.code, r.amount]));

  const rows: BudgetRow[] = [];
  // 收集所有「有預算」或「有實績」嘅 expense account
  const codes = new Set<string>([
    ...budgetMap.keys(),
    ...actualMap.keys(),
  ]);
  for (const a of expenseAccounts) {
    if (!codes.has(a.code)) continue;
    const budget = budgetMap.get(a.code) ?? null;
    const actual = actualMap.get(a.code) ?? 0;
    rows.push({
      code: a.code,
      name: a.name,
      icon: a.icon,
      budget,
      actual,
      remaining: budget != null ? budget - actual : null,
      pctUsed: budget && budget > 0 ? (actual / budget) * 100 : null,
    });
  }
  rows.sort((a, b) => b.actual - a.actual);
  return rows;
}
