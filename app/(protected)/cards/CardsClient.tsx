"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtMoney, nextDueDate } from "@/lib/finance";
import { REWARDS_TYPES } from "@/lib/constants";
import type { Account, CreditCard } from "@/lib/types";
import { upsertCard, deleteCard } from "./actions";

interface Props {
  cards: CreditCard[];
  liabAccounts: Account[];
  availableAccounts: Account[];
  balances: Record<string, number>;
}

interface FormState {
  account_code: string;
  card_last4: string;
  credit_limit: string;
  statement_day: string;
  due_day: string;
  interest_rate: string; // 顯示用 %（32 = 32%）
  annual_fee: string;
  rewards: string;
  rewards_rate: string; // %（1 = 1%）
  rewards_type: string;
  notes: string;
}

const emptyForm = (code = ""): FormState => ({
  account_code: code,
  card_last4: "",
  credit_limit: "",
  statement_day: "",
  due_day: "",
  interest_rate: "",
  annual_fee: "",
  rewards: "",
  rewards_rate: "",
  rewards_type: "cash",
  notes: "",
});

export default function CardsClient({
  cards,
  liabAccounts,
  availableAccounts,
  balances,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [isEdit, setIsEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameByCode = new Map(
    liabAccounts.map((a) => [a.code, `${a.icon ?? ""} ${a.name}`.trim()]),
  );

  function startAdd() {
    setIsEdit(false);
    setError(null);
    setForm(emptyForm(availableAccounts[0]?.code ?? ""));
  }
  function startEdit(c: CreditCard) {
    setIsEdit(true);
    setError(null);
    setForm({
      account_code: c.account_code,
      card_last4: c.card_last4 ?? "",
      credit_limit: c.credit_limit != null ? String(c.credit_limit) : "",
      statement_day: c.statement_day != null ? String(c.statement_day) : "",
      due_day: c.due_day != null ? String(c.due_day) : "",
      interest_rate:
        c.interest_rate != null ? String(c.interest_rate * 100) : "",
      annual_fee: c.annual_fee != null ? String(c.annual_fee) : "",
      rewards: c.rewards ?? "",
      rewards_rate:
        c.rewards_rate != null ? String(c.rewards_rate * 100) : "",
      rewards_type: c.rewards_type ?? "cash",
      notes: c.notes ?? "",
    });
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    setError(null);
    const res = await upsertCard({
      account_code: form.account_code,
      card_last4: form.card_last4 || null,
      credit_limit: form.credit_limit ? Number(form.credit_limit) : null,
      statement_day: form.statement_day ? Number(form.statement_day) : null,
      due_day: form.due_day ? Number(form.due_day) : null,
      interest_rate: form.interest_rate
        ? Number(form.interest_rate) / 100
        : null,
      annual_fee: form.annual_fee ? Number(form.annual_fee) : null,
      rewards: form.rewards || null,
      rewards_rate: form.rewards_rate ? Number(form.rewards_rate) / 100 : null,
      rewards_type: form.rewards_type || null,
      notes: form.notes || null,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "儲存失敗");
      return;
    }
    setForm(null);
    router.refresh();
  }

  async function handleDelete(code: string) {
    if (!confirm("刪除此信用卡資料？（帳戶本身不受影響）")) return;
    await deleteCard(code);
    router.refresh();
  }

  function patch<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  }

  return (
    <div className="p-6 md:p-10">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl md:text-3xl font-bold text-doraemon-700">
          💳 信用卡管理
        </h1>
        {!form && availableAccounts.length > 0 && (
          <button
            onClick={startAdd}
            className="bg-doraemon-500 hover:bg-doraemon-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            ➕ 新增信用卡
          </button>
        )}
      </div>
      <p className="text-sm text-slate-600 mb-6">
        信用額度 · 月結 / 還款日 · 利率 · 回贈
      </p>

      {availableAccounts.length === 0 && cards.length === 0 && !form && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3 mb-4 text-sm">
          ⚠️ 尚無「負債」類型帳戶。請先去帳戶管理建立信用卡帳戶（如 CREDIT_CARD）。
        </div>
      )}

      {/* 表單 */}
      {form && (
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-slate-700 mb-4">
            {isEdit ? "✏️ 編輯信用卡" : "➕ 新增信用卡"}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="對應帳戶（負債）">
              {isEdit ? (
                <input
                  className="input"
                  value={nameByCode.get(form.account_code) ?? form.account_code}
                  disabled
                />
              ) : (
                <select
                  className="input"
                  value={form.account_code}
                  onChange={(e) => patch("account_code", e.target.value)}
                >
                  {availableAccounts.map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.icon ?? ""} {a.name} ({a.code})
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="卡號末 4 碼">
              <input
                className="input"
                maxLength={4}
                value={form.card_last4}
                onChange={(e) => patch("card_last4", e.target.value)}
              />
            </Field>
            <Field label="信用額度 (HKD)">
              <input
                type="number"
                className="input"
                value={form.credit_limit}
                onChange={(e) => patch("credit_limit", e.target.value)}
              />
            </Field>
            <Field label="月結日 (1-31)">
              <input
                type="number"
                min={1}
                max={31}
                className="input"
                value={form.statement_day}
                onChange={(e) => patch("statement_day", e.target.value)}
              />
            </Field>
            <Field label="還款限期日 (1-31)">
              <input
                type="number"
                min={1}
                max={31}
                className="input"
                value={form.due_day}
                onChange={(e) => patch("due_day", e.target.value)}
              />
            </Field>
            <Field label="年利率 (%)">
              <input
                type="number"
                step="0.01"
                className="input"
                placeholder="例 32"
                value={form.interest_rate}
                onChange={(e) => patch("interest_rate", e.target.value)}
              />
            </Field>
            <Field label="年費 (HKD)">
              <input
                type="number"
                className="input"
                value={form.annual_fee}
                onChange={(e) => patch("annual_fee", e.target.value)}
              />
            </Field>
            <Field label="回贈率 (%)">
              <input
                type="number"
                step="0.01"
                className="input"
                placeholder="例 1"
                value={form.rewards_rate}
                onChange={(e) => patch("rewards_rate", e.target.value)}
              />
            </Field>
            <Field label="回贈類型">
              <select
                className="input"
                value={form.rewards_type}
                onChange={(e) => patch("rewards_type", e.target.value)}
              >
                {REWARDS_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-3">
            <Field label="回贈 / 里數 說明">
              <input
                className="input"
                placeholder="例：1% 現金回贈、本地簽賬 2 里"
                value={form.rewards}
                onChange={(e) => patch("rewards", e.target.value)}
              />
            </Field>
          </div>
          {error && (
            <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              ❌ {error}
            </div>
          )}
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-doraemon-500 hover:bg-doraemon-700 text-white font-medium px-6 py-2.5 rounded-lg disabled:opacity-50"
            >
              {saving ? "儲存中…" : "💾 儲存"}
            </button>
            <button
              onClick={() => setForm(null)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2.5 rounded-lg"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 卡片列表 */}
      {cards.length === 0 ? (
        !form && (
          <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-8 text-center text-slate-400">
            尚未設定任何信用卡。
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((c) => {
            const used = Math.abs(balances[c.account_code] ?? 0);
            const limit = c.credit_limit ?? 0;
            const util = limit > 0 ? (used / limit) * 100 : 0;
            const due = nextDueDate(c.due_day);
            return (
              <div
                key={c.account_code}
                className="bg-gradient-to-br from-doraemon-500 to-doraemon-700 text-white rounded-2xl shadow-lg p-6"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-bold text-lg">
                      {nameByCode.get(c.account_code) ?? c.account_code}
                    </div>
                    {c.card_last4 && (
                      <div className="text-doraemon-100 text-sm font-mono">
                        •••• {c.card_last4}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button
                      onClick={() => startEdit(c)}
                      className="bg-white/20 hover:bg-white/30 px-2 py-1 rounded"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(c.account_code)}
                      className="bg-white/20 hover:bg-white/30 px-2 py-1 rounded"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* 已用 / 額度 */}
                {limit > 0 && (
                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span>已用 {fmtMoney(used)}</span>
                      <span>額度 {fmtMoney(limit)}</span>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          util > 90 ? "bg-red-400" : util > 70 ? "bg-amber-300" : "bg-green-300"
                        }`}
                        style={{ width: `${Math.min(util, 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-doraemon-100 mt-1">
                      使用率 {util.toFixed(0)}% · 可用 {fmtMoney(limit - used)}
                    </div>
                  </div>
                )}

                {/* 細節 */}
                <div className="grid grid-cols-2 gap-2 text-xs text-doraemon-50">
                  {c.statement_day && <div>📅 月結日：{c.statement_day} 號</div>}
                  {due && <div>⏰ 下次還款：{due}</div>}
                  {c.interest_rate != null && (
                    <div>📈 年利率：{(c.interest_rate * 100).toFixed(2)}%</div>
                  )}
                  {c.annual_fee != null && c.annual_fee > 0 && (
                    <div>💵 年費：{fmtMoney(c.annual_fee)}</div>
                  )}
                  {c.rewards && (
                    <div className="col-span-2">🎁 {c.rewards}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
