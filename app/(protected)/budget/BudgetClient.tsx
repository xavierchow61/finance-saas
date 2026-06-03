"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtMoney } from "@/lib/finance";
import type { BudgetRow } from "@/lib/finance";
import { setBudgetsBatch } from "./actions";

interface Props {
  period: string;
  rows: BudgetRow[];
  expenseAccounts: { code: string; name: string; icon: string | null }[];
  existingBudgets: { account_code: string; amount: number }[];
}

export default function BudgetClient({
  period,
  rows,
  expenseAccounts,
  existingBudgets,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // 編輯中嘅預算 input（code → string）
  const initVals: Record<string, string> = {};
  for (const a of expenseAccounts) {
    const b = existingBudgets.find((x) => x.account_code === a.code);
    initVals[a.code] = b ? String(b.amount) : "";
  }
  const [vals, setVals] = useState<Record<string, string>>(initVals);

  const overBudget = rows.filter((r) => r.pctUsed != null && r.pctUsed > 100);

  function changePeriod(delta: number) {
    const [y, m] = period.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const np = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    router.push(`/budget?period=${np}`);
  }

  async function handleSave() {
    setSaving(true);
    const entries = expenseAccounts.map((a) => ({
      account_code: a.code,
      amount: Number(vals[a.code] || 0),
    }));
    const res = await setBudgetsBatch(period, entries);
    setSaving(false);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="p-6 md:p-10">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl md:text-3xl font-bold text-doraemon-700">
          🎯 預算與實績
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => changePeriod(-1)}
            className="px-3 py-1.5 bg-white rounded-lg shadow text-slate-600 hover:bg-slate-50"
          >
            ◀
          </button>
          <span className="font-semibold text-slate-700 w-24 text-center">
            {period}
          </span>
          <button
            onClick={() => changePeriod(1)}
            className="px-3 py-1.5 bg-white rounded-lg shadow text-slate-600 hover:bg-slate-50"
          >
            ▶
          </button>
        </div>
      </div>
      <p className="text-sm text-slate-600 mb-6">月度預算追蹤 · 超支警告</p>

      {/* 超支警告 */}
      {overBudget.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
          ⚠️ 有 {overBudget.length} 個類別超出預算：
          {overBudget
            .map((o) => `${o.name}（${o.pctUsed!.toFixed(0)}%）`)
            .join("、")}
        </div>
      )}

      {/* 預算表 */}
      <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-700">
            預算 vs 實績
          </h2>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="bg-doraemon-500 hover:bg-doraemon-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              ✏️ 設定預算
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-doraemon-500 hover:bg-doraemon-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {saving ? "儲存中…" : "💾 儲存"}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setVals(initVals);
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm px-4 py-2 rounded-lg"
              >
                取消
              </button>
            </div>
          )}
        </div>

        {editing ? (
          // === 編輯模式：所有支出類別 input ===
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {expenseAccounts.map((a) => (
              <div key={a.code}>
                <label className="block text-xs text-slate-500 mb-1">
                  {a.icon ?? ""} {a.name}
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  placeholder="0"
                  value={vals[a.code] ?? ""}
                  onChange={(e) =>
                    setVals((v) => ({ ...v, [a.code]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-slate-400 text-center py-8">
            此月份尚未設定預算或無支出。撳「設定預算」開始。
          </p>
        ) : (
          // === 檢視模式：預算 vs 實績表 ===
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3">類別</th>
                  <th className="py-2 pr-3 text-right">預算</th>
                  <th className="py-2 pr-3 text-right">實績</th>
                  <th className="py-2 pr-3 text-right">餘額</th>
                  <th className="py-2 w-40">使用率</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.code} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-medium">
                      {r.icon ?? ""} {r.name}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono">
                      {r.budget != null ? fmtMoney(r.budget) : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono">
                      {fmtMoney(r.actual)}
                    </td>
                    <td
                      className={`py-2 pr-3 text-right font-mono ${
                        r.remaining != null && r.remaining < 0
                          ? "text-red-600"
                          : "text-slate-700"
                      }`}
                    >
                      {r.remaining != null ? fmtMoney(r.remaining) : "—"}
                    </td>
                    <td className="py-2">
                      {r.pctUsed != null ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                r.pctUsed > 100
                                  ? "bg-red-500"
                                  : r.pctUsed > 80
                                    ? "bg-amber-500"
                                    : "bg-green-500"
                              }`}
                              style={{
                                width: `${Math.min(r.pctUsed, 100)}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 w-10 text-right">
                            {r.pctUsed.toFixed(0)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">無預算</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
