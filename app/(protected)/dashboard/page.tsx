import { createClient } from "@/lib/supabase/server";
import {
  calcAccountBalances,
  fmtMoney,
  monthlyExpenseTrend,
  expenseByCategory,
  monthRange,
  currentPeriod,
} from "@/lib/finance";
import { ExpensePie, ExpenseTrend } from "./DashboardCharts";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();

  // 並行 fetch accounts + lines（餘額用）+ dated lines（圖表用）
  const [{ data: accounts }, { data: lines }, { data: datedLines }] =
    await Promise.all([
      supabase.from("accounts").select("*").eq("is_active", true),
      supabase.from("journal_lines").select("account_code, debit, credit"),
      supabase
        .from("journal_lines")
        .select(
          "account_code, debit, credit, journal_entries!inner(entry_date)",
        ),
    ]);

  const withBal = calcAccountBalances(accounts ?? [], lines ?? []);
  const totalAssets = withBal
    .filter((a) => a.account_type === "asset")
    .reduce((s, a) => s + a.balance, 0);
  const totalLiab = withBal
    .filter((a) => a.account_type === "liability")
    .reduce((s, a) => s + a.balance, 0);
  const netWorth = totalAssets - totalLiab;

  const hasData = (accounts?.length ?? 0) > 0;

  // === 圖表資料 ===
  const accTypeByCode = new Map(
    (accounts ?? []).map((a) => [a.code, a.account_type]),
  );
  const flatDated = (datedLines ?? []).map(
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
        account_type: accTypeByCode.get(l.account_code) ?? "",
      };
    },
  );
  const { start, end } = monthRange(currentPeriod());
  const pieData = expenseByCategory(
    (accounts ?? []).map((a) => ({
      code: a.code,
      name: a.name,
      account_type: a.account_type,
    })),
    flatDated,
    start,
    end,
  );
  const trendData = monthlyExpenseTrend(flatDated, 6);

  return (
    <div className="p-6 md:p-10">
      <h1 className="text-2xl md:text-3xl font-bold text-doraemon-700 mb-1">
        🏠 儀表板
      </h1>
      <p className="text-sm text-slate-600 mb-6">個人財務總覽</p>

      {!hasData ? (
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-3">👋</div>
          <h2 className="text-xl font-bold text-slate-700 mb-2">
            歡迎使用哆啦理財！
          </h2>
          <p className="text-slate-500 mb-6">
            首先建立你嘅帳戶 — 撳下面按鈕載入預設帳戶
          </p>
          <Link
            href="/accounts"
            className="inline-block bg-doraemon-500 hover:bg-doraemon-700 text-white font-semibold px-6 py-3 rounded-xl transition"
          >
            🏦 前往帳戶管理
          </Link>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <KpiCard label="💰 總資產" value={fmtMoney(totalAssets)} color="text-green-600" />
            <KpiCard label="💳 總負債" value={fmtMoney(totalLiab)} color="text-red-600" />
            <KpiCard label="📊 淨資產" value={fmtMoney(netWorth)} color="text-doraemon-700" />
          </div>

          {/* 圖表 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-6">
              <h3 className="text-sm font-semibold text-slate-600 mb-2">
                🥧 本月支出分類
              </h3>
              <ExpensePie data={pieData} />
            </div>
            <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-6">
              <h3 className="text-sm font-semibold text-slate-600 mb-2">
                📊 近 6 個月支出走勢
              </h3>
              <ExpenseTrend data={trendData} />
            </div>
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <QuickLink href="/accounts" icon="🏦" label="帳戶管理" />
            <QuickLink href="/ledger" icon="💰" label="個人記賬" />
            <QuickLink href="/invoices" icon="📋" label="單據處理" />
            <QuickLink href="/budget" icon="🎯" label="預算追蹤" />
            <QuickLink href="/reports" icon="📈" label="財務報表" />
            <QuickLink href="/reimburse" icon="🏢" label="報銷追蹤" />
            <QuickLink href="/cards" icon="💳" label="信用卡" />
            <QuickLink href="/loans" icon="💸" label="貸款管理" />
            <QuickLink href="/settings" icon="⚙️" label="設定" />
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-6">
      <div className="text-sm text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white/95 backdrop-blur rounded-xl shadow p-5 text-center hover:shadow-lg transition"
    >
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-sm font-semibold text-slate-700">{label}</div>
    </Link>
  );
}
