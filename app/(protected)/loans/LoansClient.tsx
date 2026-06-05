"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtMoney, calcEmi, loanProgress, nextDueDate } from "@/lib/finance";
import { LOAN_TYPES } from "@/lib/constants";
import type { Loan } from "@/lib/types";
import { upsertLoan, deleteLoan } from "./actions";

interface FormState {
  id?: number;
  name: string;
  loan_type: string;
  bank: string;
  principal: string;
  interest_rate: string; // %（4.5 = 4.5%）
  term_months: string;
  start_date: string;
  due_day: string;
  notes: string;
}

const emptyForm = (): FormState => ({
  name: "",
  loan_type: "mortgage",
  bank: "",
  principal: "",
  interest_rate: "",
  term_months: "",
  start_date: new Date().toISOString().slice(0, 10),
  due_day: "",
  notes: "",
});

const typeLabel = (v: string) =>
  LOAN_TYPES.find((t) => t.value === v)?.label ?? v;

export default function LoansClient({ loans }: { loans: Loan[] }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 即時試算（form 開住時）
  const preview = form
    ? calcEmi(
        Number(form.principal) || 0,
        (Number(form.interest_rate) || 0) / 100,
        Number(form.term_months) || 0,
      )
    : 0;

  function patch<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  }

  function startEdit(l: Loan) {
    setError(null);
    setForm({
      id: l.id,
      name: l.name,
      loan_type: l.loan_type,
      bank: l.bank ?? "",
      principal: String(l.principal),
      interest_rate: String(l.interest_rate * 100),
      term_months: String(l.term_months),
      start_date: l.start_date,
      due_day: l.due_day != null ? String(l.due_day) : "",
      notes: l.notes ?? "",
    });
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    setError(null);
    const res = await upsertLoan({
      id: form.id,
      name: form.name,
      loan_type: form.loan_type,
      bank: form.bank || null,
      principal: Number(form.principal) || 0,
      interest_rate: (Number(form.interest_rate) || 0) / 100,
      term_months: Number(form.term_months) || 0,
      start_date: form.start_date,
      due_day: form.due_day ? Number(form.due_day) : null,
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

  async function handleDelete(id: number) {
    if (!confirm("確定刪除此貸款紀錄？")) return;
    await deleteLoan(id);
    router.refresh();
  }

  return (
    <div className="p-6 md:p-10">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl md:text-3xl font-bold text-doraemon-700">
          💸 貸款管理
        </h1>
        {!form && (
          <button
            onClick={() => {
              setError(null);
              setForm(emptyForm());
            }}
            className="bg-doraemon-500 hover:bg-doraemon-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            ➕ 新增貸款
          </button>
        )}
      </div>
      <p className="text-sm text-slate-600 mb-6">
        EMI 試算 · 還款進度 · 剩餘本金
      </p>

      {/* 表單 */}
      {form && (
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-slate-700 mb-4">
            {form.id ? "✏️ 編輯貸款" : "➕ 新增貸款"}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="貸款名稱">
              <input
                className="input"
                placeholder="例：東亞按揭"
                value={form.name}
                onChange={(e) => patch("name", e.target.value)}
              />
            </Field>
            <Field label="類型">
              <select
                className="input"
                value={form.loan_type}
                onChange={(e) => patch("loan_type", e.target.value)}
              >
                {LOAN_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="銀行 / 機構">
              <input
                className="input"
                value={form.bank}
                onChange={(e) => patch("bank", e.target.value)}
              />
            </Field>
            <Field label="本金 (HKD)">
              <input
                type="number"
                className="input"
                value={form.principal}
                onChange={(e) => patch("principal", e.target.value)}
              />
            </Field>
            <Field label="年利率 (%)">
              <input
                type="number"
                step="0.01"
                className="input"
                placeholder="例 4.5"
                value={form.interest_rate}
                onChange={(e) => patch("interest_rate", e.target.value)}
              />
            </Field>
            <Field label="還款期數 (月)">
              <input
                type="number"
                className="input"
                placeholder="例 360"
                value={form.term_months}
                onChange={(e) => patch("term_months", e.target.value)}
              />
            </Field>
            <Field label="開始日期">
              <input
                type="date"
                className="input"
                value={form.start_date}
                onChange={(e) => patch("start_date", e.target.value)}
              />
            </Field>
            <Field label="每月還款日 (1-31)">
              <input
                type="number"
                min={1}
                max={31}
                className="input"
                value={form.due_day}
                onChange={(e) => patch("due_day", e.target.value)}
              />
            </Field>
          </div>

          {/* 即時 EMI 試算 */}
          {preview > 0 && (
            <div className="mt-4 bg-doraemon-50 border border-doraemon-200 rounded-xl px-4 py-3">
              <span className="text-sm text-slate-600">💡 每月應供：</span>
              <span className="text-xl font-bold text-doraemon-700 ml-2">
                {fmtMoney(preview)}
              </span>
              <span className="text-xs text-slate-500 ml-3">
                總還款 {fmtMoney(preview * (Number(form.term_months) || 0))} ·
                總利息{" "}
                {fmtMoney(
                  preview * (Number(form.term_months) || 0) -
                    (Number(form.principal) || 0),
                )}
              </span>
            </div>
          )}

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

      {/* 貸款列表 */}
      {loans.length === 0 ? (
        !form && (
          <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-8 text-center text-slate-400">
            尚無貸款紀錄。
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loans.map((l) => {
            const prog = loanProgress(
              l.principal,
              l.interest_rate,
              l.term_months,
              l.start_date,
            );
            const pct = (prog.paidMonths / l.term_months) * 100;
            const due = nextDueDate(l.due_day);
            return (
              <div
                key={l.id}
                className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-6"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-bold text-lg text-slate-800">
                      {l.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {typeLabel(l.loan_type)}
                      {l.bank ? ` · ${l.bank}` : ""}
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button
                      onClick={() => startEdit(l)}
                      className="text-doraemon-600 hover:text-doraemon-700"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(l.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm my-3">
                  <Stat label="本金" value={fmtMoney(l.principal)} />
                  <Stat
                    label="每月應供"
                    value={fmtMoney(l.monthly_payment ?? 0)}
                    highlight
                  />
                  <Stat
                    label="年利率"
                    value={`${(l.interest_rate * 100).toFixed(2)}%`}
                  />
                  <Stat label="期數" value={`${l.term_months} 月`} />
                  <Stat
                    label="剩餘本金"
                    value={fmtMoney(prog.remainingBalance)}
                  />
                  {due && <Stat label="下次還款" value={due} />}
                </div>

                {/* 還款進度 */}
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>
                      已還 {prog.paidMonths} / {l.term_months} 期
                    </span>
                    <span>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-doraemon-500 rounded-full"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
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

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <span className="text-slate-500">{label}：</span>
      <span
        className={`font-mono ${highlight ? "font-bold text-doraemon-700" : "text-slate-700"}`}
      >
        {value}
      </span>
    </div>
  );
}
