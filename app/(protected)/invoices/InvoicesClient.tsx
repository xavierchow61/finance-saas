"use client";

import { useState, useRef } from "react";
import type {
  Account,
  Invoice,
  ExtractedInvoice,
  ExpenseType,
} from "@/lib/types";
import { CATEGORIES, EXPENSE_TYPES, CURRENCIES } from "@/lib/constants";
import { fmtMoney } from "@/lib/finance";
import {
  saveInvoice,
  updateInvoice,
  deleteInvoice,
  toggleReimbursed,
} from "./actions";

interface Props {
  invoices: Invoice[];
  paymentAccounts: Account[];
}

// 編輯中嘅 form state（由 ExtractedInvoice 衍生）
interface FormState {
  purchase_date: string;
  store_name: string;
  category: string;
  expense_type: ExpenseType;
  total_amount: string;
  currency: string;
  payment_method: string;
  tax: string;
  receipt_number: string;
  notes: string;
  items: { name: string; quantity?: string; price?: string }[];
  autoPost: boolean;
  paymentAccount: string;
}

export default function InvoicesClient({
  invoices,
  paymentAccounts,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // 編輯模式：記住正在編輯嘅 invoice id（null = 新增模式）
  const [editId, setEditId] = useState<number | null>(null);

  const defaultPayAcc =
    paymentAccounts.find((a) => a.code === "CASH")?.code ??
    paymentAccounts[0]?.code ??
    "";

  // ---- 進入編輯模式 ----
  function startEdit(inv: Invoice) {
    setEditId(inv.id);
    setPreviewUrl(null);
    setError(null);
    setInfo(null);
    setForm({
      purchase_date:
        inv.purchase_date ?? new Date().toISOString().slice(0, 10),
      store_name: inv.store_name ?? "",
      category: inv.category ?? "其他",
      expense_type: inv.expense_type,
      total_amount: inv.total_amount != null ? String(inv.total_amount) : "",
      currency: inv.currency ?? "HKD",
      payment_method: inv.payment_method ?? "",
      tax: inv.tax != null ? String(inv.tax) : "",
      receipt_number: inv.receipt_number ?? "",
      notes: inv.notes ?? "",
      items: (inv.items_json ?? []).map((it) => ({
        name: it.name,
        quantity: it.quantity != null ? String(it.quantity) : "",
        price: it.price != null ? String(it.price) : "",
      })),
      autoPost: false, // 編輯時預設唔重新入賬
      paymentAccount: defaultPayAcc,
    });
    // scroll 返上去 form
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---- 上傳 + AI 提取 ----
  async function handleFile(file: File) {
    setError(null);
    setInfo(null);
    setExtracting(true);
    setPreviewUrl(URL.createObjectURL(file));
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/extract", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "提取失敗");

      const d = json.data as ExtractedInvoice;
      setForm({
        purchase_date:
          d.purchase_date ?? new Date().toISOString().slice(0, 10),
        store_name: d.store_name ?? "",
        category: d.category ?? "其他",
        expense_type: "私人",
        total_amount: d.total_amount != null ? String(d.total_amount) : "",
        currency: d.currency ?? "HKD",
        payment_method: d.payment_method ?? "",
        tax: d.tax != null ? String(d.tax) : "",
        receipt_number: d.receipt_number ?? "",
        notes: "",
        items: d.items.map((it) => ({
          name: it.name,
          quantity: it.quantity != null ? String(it.quantity) : "",
          price: it.price != null ? String(it.price) : "",
        })),
        autoPost: true,
        paymentAccount: defaultPayAcc,
      });
    } catch (ex: unknown) {
      setError(ex instanceof Error ? ex.message : String(ex));
    } finally {
      setExtracting(false);
    }
  }

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  // ---- 儲存（新增 or 編輯）----
  async function handleSave() {
    if (!form) return;
    setSaving(true);
    setError(null);
    setInfo(null);

    const res = editId
      ? await updateInvoice({
          id: editId,
          purchase_date: form.purchase_date || null,
          store_name: form.store_name || null,
          category: form.category || null,
          expense_type: form.expense_type,
          total_amount: form.total_amount ? Number(form.total_amount) : null,
          currency: form.currency,
          payment_method: form.payment_method || null,
          tax: form.tax ? Number(form.tax) : null,
          receipt_number: form.receipt_number || null,
          notes: form.notes || null,
        })
      : await saveInvoice({
          purchase_date: form.purchase_date || null,
          store_name: form.store_name || null,
          category: form.category || null,
          expense_type: form.expense_type,
          total_amount: form.total_amount ? Number(form.total_amount) : null,
          currency: form.currency,
          payment_method: form.payment_method || null,
          tax: form.tax ? Number(form.tax) : null,
          receipt_number: form.receipt_number || null,
          items: form.items.filter((i) => i.name.trim()),
          notes: form.notes || null,
          autoPost: form.autoPost,
          paymentAccount: form.autoPost ? form.paymentAccount : null,
        });

    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "儲存失敗");
      return;
    }
    if (res.error) setInfo(res.error);
    setForm(null);
    setEditId(null);
    setPreviewUrl(null);
    if (fileRef.current) fileRef.current.value = "";
    window.location.reload();
  }

  async function handleDelete(id: number) {
    if (!confirm("確定刪除此單據？相關分錄亦會一併刪除")) return;
    const res = await deleteInvoice(id);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    window.location.reload();
  }

  async function handleToggle(inv: Invoice) {
    await toggleReimbursed(inv.id, inv.reimbursed);
    window.location.reload();
  }

  return (
    <div className="p-6 md:p-10">
      <h1 className="text-2xl md:text-3xl font-bold text-doraemon-700 mb-1">
        📋 單據處理
      </h1>
      <p className="text-sm text-slate-600 mb-6">
        上傳收據 → AI 自動提取 → 確認入賬
      </p>

      {/* ===== 上傳區 ===== */}
      <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-6 mb-6">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={extracting}
          className="w-full border-2 border-dashed border-doraemon-300 rounded-xl py-10 hover:bg-doraemon-50 transition disabled:opacity-50"
        >
          <div className="text-4xl mb-2">{extracting ? "🤖" : "📤"}</div>
          <div className="font-semibold text-doraemon-700">
            {extracting ? "AI 提取中…請稍候" : "撳此上傳收據圖片 / PDF"}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            支援 JPG / PNG / PDF，上限 10 MB
          </div>
        </button>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
            ❌ {error}
          </div>
        )}
        {info && (
          <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg px-3 py-2">
            ⚠️ {info}
          </div>
        )}
      </div>

      {/* ===== 提取結果編輯區 ===== */}
      {form && (
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-slate-700 mb-4">
            {editId ? "✏️ 編輯單據" : "✏️ 核對提取結果"}
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 圖片預覽 */}
            {previewUrl && (
              <div className="lg:col-span-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="單據預覽"
                  className="w-full rounded-lg border border-slate-200 max-h-96 object-contain bg-slate-50"
                />
              </div>
            )}

            {/* 表單 */}
            <div className="lg:col-span-2 grid grid-cols-2 gap-3">
              <Field label="日期">
                <input
                  type="date"
                  className="input"
                  value={form.purchase_date}
                  onChange={(e) => patch("purchase_date", e.target.value)}
                />
              </Field>
              <Field label="商戶">
                <input
                  className="input"
                  value={form.store_name}
                  onChange={(e) => patch("store_name", e.target.value)}
                />
              </Field>
              <Field label="總金額">
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={form.total_amount}
                  onChange={(e) => patch("total_amount", e.target.value)}
                />
              </Field>
              <Field label="幣別">
                <select
                  className="input"
                  value={form.currency}
                  onChange={(e) => patch("currency", e.target.value)}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="類別">
                <select
                  className="input"
                  value={form.category}
                  onChange={(e) => patch("category", e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="支出類型">
                <select
                  className="input"
                  value={form.expense_type}
                  onChange={(e) =>
                    patch("expense_type", e.target.value as ExpenseType)
                  }
                >
                  {EXPENSE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="付款方式">
                <input
                  className="input"
                  value={form.payment_method}
                  onChange={(e) => patch("payment_method", e.target.value)}
                />
              </Field>
              <Field label="單號">
                <input
                  className="input"
                  value={form.receipt_number}
                  onChange={(e) => patch("receipt_number", e.target.value)}
                />
              </Field>
            </div>
          </div>

          {/* 入賬選項（只喺新增模式顯示；編輯唔重新入賬）*/}
          <div
            className="mt-5 pt-5 border-t border-slate-200"
            style={{ display: editId ? "none" : "block" }}
          >
            <label className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                checked={form.autoPost}
                onChange={(e) => patch("autoPost", e.target.checked)}
                className="w-4 h-4"
              />
              <span className="font-medium text-slate-700">
                ⚡ 自動入賬（建立雙式分錄）
              </span>
            </label>
            {form.autoPost && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-600">付款 / 來源帳戶：</span>
                <select
                  className="input max-w-xs"
                  value={form.paymentAccount}
                  onChange={(e) => patch("paymentAccount", e.target.value)}
                >
                  {paymentAccounts.map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.icon ?? ""} {a.name} ({a.code})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {form.autoPost && (
              <p className="text-xs text-slate-400 mt-2">
                {form.expense_type === "公司報銷"
                  ? "公司報銷 → Dr 應收（AR_REIMBURSE）/ Cr 上述帳戶"
                  : `Dr ${form.category}（支出）/ Cr 上述帳戶`}
              </p>
            )}
          </div>

          {/* 動作按鈕 */}
          <div className="mt-5 flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-doraemon-500 hover:bg-doraemon-700 text-white font-semibold px-6 py-2.5 rounded-lg transition disabled:opacity-50"
            >
              {saving ? "儲存中…" : "💾 確認儲存"}
            </button>
            <button
              onClick={() => {
                setForm(null);
                setEditId(null);
                setPreviewUrl(null);
              }}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-6 py-2.5 rounded-lg transition"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* ===== 單據列表 ===== */}
      <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-6">
        <h2 className="text-lg font-bold text-slate-700 mb-4">
          📜 單據紀錄（{invoices.length}）
        </h2>
        {invoices.length === 0 ? (
          <p className="text-slate-400 text-center py-8">
            尚無單據。上傳第一張收據開始吧！
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3">日期</th>
                  <th className="py-2 pr-3">商戶</th>
                  <th className="py-2 pr-3">類別</th>
                  <th className="py-2 pr-3">類型</th>
                  <th className="py-2 pr-3 text-right">金額</th>
                  <th className="py-2 pr-3">報銷</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="py-2 pr-3">{inv.purchase_date ?? "—"}</td>
                    <td className="py-2 pr-3 font-medium">
                      {inv.store_name ?? "—"}
                    </td>
                    <td className="py-2 pr-3">{inv.category ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          inv.expense_type === "公司報銷"
                            ? "bg-amber-100 text-amber-700"
                            : inv.expense_type === "可扣稅"
                              ? "bg-green-100 text-green-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {inv.expense_type}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right font-mono">
                      {fmtMoney(inv.total_amount ?? 0)}
                    </td>
                    <td className="py-2 pr-3">
                      {inv.expense_type === "公司報銷" ? (
                        <button
                          onClick={() => handleToggle(inv)}
                          className="text-xs"
                          title="切換報銷狀態"
                        >
                          {inv.reimbursed ? "✅ 已收" : "⏳ 待收"}
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => startEdit(inv)}
                        className="text-doraemon-600 hover:text-doraemon-700 text-xs mr-3"
                      >
                        ✏️ 編輯
                      </button>
                      <button
                        onClick={() => handleDelete(inv.id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        🗑️ 刪除
                      </button>
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
