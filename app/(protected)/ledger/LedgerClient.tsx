"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  AccountWithBalance,
  JournalEntryWithLines,
} from "@/lib/types";
import { CURRENCIES } from "@/lib/constants";
import { groupAccountsWithParentTotals, fmtMoney } from "@/lib/finance";
import { createEntry, deleteEntry } from "./actions";

type Tab = "entries" | "overview" | "new";

export default function LedgerClient({
  entries,
  accounts,
}: {
  entries: JournalEntryWithLines[];
  accounts: AccountWithBalance[];
}) {
  const [tab, setTab] = useState<Tab>("entries");
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div>
      {toast && (
        <div className="mb-4 bg-doraemon-50 border border-doraemon-300 text-doraemon-700 rounded-lg px-4 py-2 text-sm">
          {toast}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-5 w-fit">
        {(
          [
            ["entries", "📜 交易紀錄"],
            ["overview", "🏦 帳戶總覽"],
            ["new", "➕ 新增分錄"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === k
                ? "bg-white text-doraemon-700 shadow"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "entries" && (
        <EntriesTab entries={entries} onToast={showToast} />
      )}
      {tab === "overview" && <OverviewTab accounts={accounts} />}
      {tab === "new" && (
        <NewEntryTab
          accounts={accounts}
          onDone={(msg) => {
            showToast(msg);
            setTab("entries");
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Tab 1：交易紀錄
// ============================================================
function EntriesTab({
  entries,
  onToast,
}: {
  entries: JournalEntryWithLines[];
  onToast: (m: string) => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  if (entries.length === 0) {
    return (
      <div className="bg-white/95 rounded-2xl shadow-lg p-8 text-center text-slate-500">
        尚無分錄。請去「➕ 新增分錄」開始記賬。
      </div>
    );
  }

  const sel = entries.find((e) => e.id === selected);

  function summarize(e: JournalEntryWithLines) {
    return e.journal_lines
      .map((l) =>
        l.debit > 0
          ? `${l.account_code}:Dr ${l.debit}`
          : `${l.account_code}:Cr ${l.credit}`,
      )
      .join(" | ");
  }
  function amountOf(e: JournalEntryWithLines) {
    return Math.max(...e.journal_lines.map((l) => l.debit), 0);
  }

  return (
    <div>
      <p className="text-xs text-slate-500 mb-2">
        最新 {entries.length} 筆 · 點擊任何一行查看詳細
      </p>
      <div className="bg-white/95 rounded-2xl shadow-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-3 font-medium">日期</th>
              <th className="text-left px-4 py-3 font-medium">說明</th>
              <th className="text-left px-4 py-3 font-medium">幣別</th>
              <th className="text-right px-4 py-3 font-medium">金額</th>
              <th className="text-left px-4 py-3 font-medium">分錄細項</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr
                key={e.id}
                onClick={() => setSelected(e.id === selected ? null : e.id)}
                className={`border-t border-slate-100 cursor-pointer transition ${
                  e.id === selected
                    ? "bg-doraemon-50"
                    : "hover:bg-doraemon-50/40"
                }`}
              >
                <td className="px-4 py-2.5">{e.entry_date}</td>
                <td className="px-4 py-2.5">{e.description}</td>
                <td className="px-4 py-2.5">{e.currency}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {fmtMoney(amountOf(e), e.currency)}
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-500 font-mono">
                  {summarize(e)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 詳細 */}
      {sel && (
        <div className="bg-white/95 rounded-2xl shadow-lg p-6 mt-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                📋 分錄 #{sel.id}：{sel.description}
              </h3>
              <p className="text-xs text-slate-500 mt-1">📅 {sel.entry_date}</p>
            </div>
            <button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await deleteEntry(sel.id);
                  if (r.ok) {
                    setSelected(null);
                    onToast(`🗑️ 已刪除分錄 #${sel.id}`);
                    router.refresh();
                  } else onToast(`❌ ${r.error}`);
                })
              }
              className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-medium rounded-lg border border-red-200 transition disabled:opacity-50"
            >
              🗑️ 刪除此分錄
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-2 font-medium">帳戶</th>
                <th className="text-right px-4 py-2 font-medium">借方</th>
                <th className="text-right px-4 py-2 font-medium">貸方</th>
              </tr>
            </thead>
            <tbody>
              {sel.journal_lines.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-mono text-xs">
                    {l.account_code}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {l.debit > 0 ? fmtMoney(l.debit) : ""}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {l.credit > 0 ? fmtMoney(l.credit) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Tab 2：帳戶總覽
// ============================================================
function OverviewTab({ accounts }: { accounts: AccountWithBalance[] }) {
  const grouped = groupAccountsWithParentTotals(accounts);
  return (
    <div className="bg-white/95 rounded-2xl shadow-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="text-left px-4 py-3 font-medium">帳戶</th>
            <th className="text-left px-4 py-3 font-medium">類型</th>
            <th className="text-right px-4 py-3 font-medium">
              目前餘額 (HKD)
            </th>
          </tr>
        </thead>
        <tbody>
          {grouped.map(({ account: a, depth, aggregatedBalance, isParent, childCount }) => (
            <tr key={a.code} className="border-t border-slate-100">
              <td className="px-4 py-2.5">
                {depth > 0 && <span className="text-slate-400">　└ </span>}
                {a.icon} {a.name}
                {isParent && (
                  <span className="text-xs text-slate-400 ml-1">
                    （合計 {childCount} 子）
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-slate-500">
                {a.account_type}
              </td>
              <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                {fmtMoney(isParent ? aggregatedBalance : a.balance)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// Tab 3：新增分錄
// ============================================================
function NewEntryTab({
  accounts,
  onDone,
}: {
  accounts: AccountWithBalance[];
  onDone: (msg: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState(0);
  const [desc, setDesc] = useState("");
  const [currency, setCurrency] = useState("HKD");
  const [fromAcc, setFromAcc] = useState("");
  const [toAcc, setToAcc] = useState("");

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await createEntry({
        entry_date: date,
        description: desc,
        currency,
        from_account: fromAcc,
        to_account: toAcc,
        amount,
      });
      if (r.ok) {
        onDone(`✅ 已寫入分錄`);
        router.refresh();
        setAmount(0);
        setDesc("");
        setFromAcc("");
        setToAcc("");
      } else setError(r.error ?? "失敗");
    });
  }

  return (
    <div className="bg-white/95 rounded-2xl shadow-lg p-6 max-w-2xl">
      <h3 className="text-lg font-bold text-slate-800 mb-1">➕ 新增手動分錄</h3>
      <p className="text-xs text-slate-500 mb-4">
        例如：薪金、帳戶轉移、信用卡還款
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            日期
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            金額
          </label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            className="input"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            說明
          </label>
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="例：6 月薪金"
            className="input"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            幣別
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="input"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div />

        <CascadePicker
          label="借方帳戶（Dr）"
          accounts={accounts}
          value={fromAcc}
          onChange={setFromAcc}
        />
        <CascadePicker
          label="貸方帳戶（Cr）"
          accounts={accounts}
          value={toAcc}
          onChange={setToAcc}
        />
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
          ❌ {error}
        </div>
      )}

      <button
        onClick={submit}
        disabled={pending}
        className="mt-5 bg-doraemon-500 hover:bg-doraemon-700 text-white font-semibold px-6 py-2.5 rounded-lg transition disabled:opacity-50"
      >
        {pending ? "處理中..." : "💾 寫入分錄"}
      </button>
    </div>
  );
}
