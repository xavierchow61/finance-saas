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
