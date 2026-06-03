import { createClient } from "@/lib/supabase/server";
import {
  calcAccountBalances,
  groupAccountsWithParentTotals,
  incomeStatement,
  monthRange,
  currentPeriod,
  fmtMoney,
} from "@/lib/finance";
import type { Account, JournalLine } from "@/lib/types";
import Link from "next/link";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const sp = await searchParams;
  const period = sp.period || currentPeriod();
  const { start, end } = monthRange(period);

  const supabase = await createClient();
  const [{ data: accounts }, { data: allLines }, { data: datedLines }] =
    await Promise.all([
      supabase.from("accounts").select("*").eq("is_active", true),
      // 全部 lines（計餘額 → 資產負債表）
      supabase.from("journal_lines").select("account_code, debit, credit"),
      // 帶日期 lines（計期間 P&L）
      supabase
        .from("journal_lines")
        .select(
          "account_code, debit, credit, journal_entries!inner(entry_date)",
        ),
    ]);

  const accs = (accounts ?? []) as Account[];

  // === 收支表（P&L）===
  const flatLines = (datedLines ?? []).map(
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
  const pnl = incomeStatement(accs, flatLines, start, end);

  // === 資產負債表（截至今日所有 lines）===
  const withBal = calcAccountBalances(accs, (allLines ?? []) as JournalLine[]);
  const assets = withBal.filter((a) => a.account_type === "asset");
  const liabs = withBal.filter((a) => a.account_type === "liability");
  const assetGroups = groupAccountsWithParentTotals(assets);
  const liabGroups = groupAccountsWithParentTotals(liabs);
  const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
  const totalLiab = liabs.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="p-6 md:p-10">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl md:text-3xl font-bold text-doraemon-700">
          📈 財務報表
        </h1>
        <PeriodNav period={period} />
      </div>
      <p className="text-sm text-slate-600 mb-6">收支表 · 資產負債表</p>

      {/* ===== 收支表 ===== */}
      <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-6 mb-6">
        <h2 className="text-lg font-bold text-slate-700 mb-1">
          💰 收支表（{period}）
        </h2>
        <div className="grid grid-cols-3 gap-4 my-4">
          <Kpi label="總收入" value={fmtMoney(pnl.totalIncome)} color="text-green-600" />
          <Kpi label="總支出" value={fmtMoney(pnl.totalExpense)} color="text-amber-600" />
          <Kpi
            label="淨額"
            value={fmtMoney(pnl.net)}
            color={pnl.net >= 0 ? "text-green-600" : "text-red-600"}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div>
            <h3 className="font-semibold text-green-700 mb-2">💼 收入</h3>
            <PnlTable rows={pnl.income} empty="此期間無收入" />
          </div>
          <div>
            <h3 className="font-semibold text-amber-700 mb-2">🛒 支出</h3>
            <PnlTable rows={pnl.expense} empty="此期間無支出" />
          </div>
        </div>
      </div>

      {/* ===== 資產負債表 ===== */}
      <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-6">
        <h2 className="text-lg font-bold text-slate-700 mb-1">
          🏦 資產負債表（截至今日）
        </h2>
        <div className="grid grid-cols-3 gap-4 my-4">
          <Kpi label="總資產" value={fmtMoney(totalAssets)} color="text-green-600" />
          <Kpi label="總負債" value={fmtMoney(totalLiab)} color="text-red-600" />
          <Kpi
            label="淨資產"
            value={fmtMoney(totalAssets - totalLiab)}
            color="text-doraemon-700"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div>
            <h3 className="font-semibold text-green-700 mb-2">💵 資產</h3>
            <BalanceTable groups={assetGroups} empty="無資產帳戶" />
          </div>
          <div>
            <h3 className="font-semibold text-red-700 mb-2">💳 負債</h3>
            <BalanceTable groups={liabGroups} empty="🎉 並無負債" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PeriodNav({ period }: { period: string }) {
  const [y, m] = period.split("-").map(Number);
  const prev = new Date(y, m - 2, 1);
  const next = new Date(y, m, 1);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/reports?period=${fmt(prev)}`}
        className="px-3 py-1.5 bg-white rounded-lg shadow text-slate-600 hover:bg-slate-50"
      >
        ◀
      </Link>
      <span className="font-semibold text-slate-700 w-24 text-center">
        {period}
      </span>
      <Link
        href={`/reports?period=${fmt(next)}`}
        className="px-3 py-1.5 bg-white rounded-lg shadow text-slate-600 hover:bg-slate-50"
      >
        ▶
      </Link>
    </div>
  );
}

function Kpi({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-slate-50 rounded-xl p-4 text-center">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function PnlTable({
  rows,
  empty,
}: {
  rows: { code: string; name: string; icon: string | null; amount: number }[];
  empty: string;
}) {
  if (rows.length === 0)
    return <p className="text-sm text-slate-400 py-4">{empty}</p>;
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((r) => (
          <tr key={r.code} className="border-b border-slate-100">
            <td className="py-1.5">
              {r.icon ?? ""} {r.name}
            </td>
            <td className="py-1.5 text-right font-mono">{fmtMoney(r.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BalanceTable({
  groups,
  empty,
}: {
  groups: {
    account: { code: string; name: string; icon: string | null; balance: number };
    depth: number;
    aggregatedBalance: number;
    isParent: boolean;
    childCount: number;
  }[];
  empty: string;
}) {
  const visible = groups.filter(
    (g) => Math.abs(g.aggregatedBalance) > 0.005 || g.account.code === "CASH",
  );
  if (visible.length === 0)
    return <p className="text-sm text-slate-400 py-4">{empty}</p>;
  return (
    <table className="w-full text-sm">
      <tbody>
        {visible.map((g) => (
          <tr key={g.account.code} className="border-b border-slate-100">
            <td className="py-1.5">
              {g.depth > 0 && <span className="text-slate-300">　└ </span>}
              {g.account.icon ?? ""} {g.account.name}
              {g.isParent && (
                <span className="text-xs text-slate-400 ml-1">
                  （含 {g.childCount} 子）
                </span>
              )}
            </td>
            <td className="py-1.5 text-right font-mono">
              {fmtMoney(
                g.isParent ? g.aggregatedBalance : g.account.balance,
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
