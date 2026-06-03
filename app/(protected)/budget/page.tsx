import { createClient } from "@/lib/supabase/server";
import {
  incomeStatement,
  budgetVsActual,
  monthRange,
  currentPeriod,
} from "@/lib/finance";
import BudgetClient from "./BudgetClient";

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const sp = await searchParams;
  const period = sp.period || currentPeriod();
  const { start, end } = monthRange(period);

  const supabase = await createClient();

  const [{ data: accounts }, { data: lines }, { data: budgets }] =
    await Promise.all([
      supabase
        .from("accounts")
        .select("code, name, icon, account_type")
        .eq("is_active", true),
      supabase
        .from("journal_lines")
        .select("account_code, debit, credit, journal_entries!inner(entry_date)"),
      supabase.from("budgets").select("account_code, amount").eq("period", period),
    ]);

  // 攤平 lines（join entry_date）
  const flatLines = (lines ?? []).map(
    (l: {
      account_code: string;
      debit: number;
      credit: number;
      journal_entries: { entry_date: string } | { entry_date: string }[];
    }) => {
      const je = Array.isArray(l.journal_entries)
        ? l.journal_entries[0]
        : l.journal_entries;
      return {
        account_code: l.account_code,
        debit: l.debit,
        credit: l.credit,
        entry_date: je?.entry_date ?? "",
      };
    },
  );

  const accs = accounts ?? [];
  const pnl = incomeStatement(accs, flatLines, start, end);
  const expenseAccounts = accs
    .filter((a) => a.account_type === "expense")
    .map((a) => ({ code: a.code, name: a.name, icon: a.icon }));
  const rows = budgetVsActual(expenseAccounts, budgets ?? [], pnl.expense);

  return (
    <BudgetClient
      period={period}
      rows={rows}
      expenseAccounts={expenseAccounts}
      existingBudgets={budgets ?? []}
    />
  );
}
