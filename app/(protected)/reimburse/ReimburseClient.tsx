"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtMoney } from "@/lib/finance";
import type { Account, Invoice } from "@/lib/types";
import { markReceived, undoReceived } from "./actions";

interface Props {
  invoices: Invoice[];
  assetAccounts: Account[];
}

export default function ReimburseClient({ invoices, assetAccounts }: Props) {
  const router = useRouter();
  const pending = invoices.filter((i) => !i.reimbursed);
  const done = invoices.filter((i) => i.reimbursed);

  const pendingTotal = pending.reduce(
    (s, i) => s + (i.total_amount ?? 0),
    0,
  );
  const doneTotal = done.reduce((s, i) => s + (i.total_amount ?? 0), 0);

  const [selected, setSelected] = useState<Invoice | null>(null);
  const defaultAcc =
    assetAccounts.find((a) => a.code === "BANK")?.code ??
    assetAccounts[0]?.code ??
    "";
  const [account, setAccount] = useState(defaultAcc);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReceive() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const res = await markReceived({
      invoiceId: selected.id,
      amount: selected.total_amount ?? 0,
      receivedAccount: account,
      receivedDate: date,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "收款失敗");
      return;
    }
    setSelected(null);
    router.refresh();
  }

  async function handleUndo(inv: Invoice) {
    if (
      !confirm("撤銷已收款狀態？\n注意：原收款分錄不會自動刪除，請自行至個人記賬處理")
    )
      return;
    await undoReceived(inv.id);
    router.refresh();
  }

  return (
    <div className="p-6 md:p-10">
      <h1 className="text-2xl md:text-3xl font-bold text-doraemon-700 mb-1">
        🏢 報銷追蹤
      </h1>
      <p className="text-sm text-slate-600 mb-6">
        公司報銷待收款清單 · 一鍵收款入賬
      </p>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-6">
          <div className="text-sm text-slate-500 mb-1">⏳ 待收款</div>
          <div className="text-2xl font-bold text-amber-600">
            {fmtMoney(pendingTotal)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {pending.length} 張單據
          </div>
        </div>
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-6">
          <div className="text-sm text-slate-500 mb-1">✅ 已收款</div>
          <div className="text-2xl font-bold text-green-600">
            {fmtMoney(doneTotal)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {done.length} 張單據
          </div>
        </div>
      </div>

      {/* 待收款清單 */}
      <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-6 mb-6">
        <h2 className="text-lg font-bold text-slate-700 mb-4">
          ⏳ 待收款清單
        </h2>
        {pending.length === 0 ? (
          <p className="text-slate-400 text-center py-8">
            🎉 目前沒有待收款的報銷單據
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3">日期</th>
                  <th className="py-2 pr-3">商戶</th>
                  <th className="py-2 pr-3">類別</th>
                  <th className="py-2 pr-3 text-right">金額</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {pending.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="py-2 pr-3">{inv.purchase_date ?? "—"}</td>
                    <td className="py-2 pr-3 font-medium">
                      {inv.store_name ?? "—"}
                    </td>
                    <td className="py-2 pr-3">{inv.category ?? "—"}</td>
                    <td className="py-2 pr-3 text-right font-mono">
                      {fmtMoney(inv.total_amount ?? 0)}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => {
                          setSelected(inv);
                          setError(null);
                        }}
                        className="bg-doraemon-500 hover:bg-doraemon-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg"
                      >
                        💰 收款
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 收款表單 */}
        {selected && (
          <div className="mt-5 pt-5 border-t border-slate-200">
            <h3 className="font-semibold text-slate-700 mb-3">
              💰 標記收款：{selected.store_name}（
              {fmtMoney(selected.total_amount ?? 0)}）
            </h3>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  收款入帳戶
                </label>
                <select
                  className="input"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                >
                  {assetAccounts.map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.icon ?? ""} {a.name} ({a.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  收款日期
                </label>
                <input
                  type="date"
                  className="input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <button
                onClick={handleReceive}
                disabled={busy}
                className="bg-green-600 hover:bg-green-700 text-white font-medium px-5 py-2 rounded-lg disabled:opacity-50"
              >
                {busy ? "入賬中…" : "✅ 確認收款並入賬"}
              </button>
              <button
                onClick={() => setSelected(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg"
              >
                取消
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Dr {account} / Cr AR_REIMBURSE（沖銷應收）
            </p>
            {error && (
              <div className="mt-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                ❌ {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 已收款歷史 */}
      {done.length > 0 && (
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-bold text-slate-700 mb-4">
            ✅ 已收款歷史
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3">日期</th>
                  <th className="py-2 pr-3">商戶</th>
                  <th className="py-2 pr-3 text-right">金額</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {done.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3">{inv.purchase_date ?? "—"}</td>
                    <td className="py-2 pr-3 font-medium">
                      {inv.store_name ?? "—"}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono">
                      {fmtMoney(inv.total_amount ?? 0)}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => handleUndo(inv)}
                        className="text-slate-400 hover:text-red-500 text-xs"
                      >
                        ↩️ 撤銷
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
