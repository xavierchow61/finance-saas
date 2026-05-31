"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AccountType, AccountWithBalance } from "@/lib/types";
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_OPTIONS,
  ACCOUNT_SUB_TYPES,
  CURRENCIES,
} from "@/lib/constants";
import { groupAccountsWithParentTotals, fmtMoney } from "@/lib/finance";
import { upsertAccount, deleteAccount, seedDefaultAccounts } from "./actions";

type DialogMode = "new" | "edit" | null;

export default function AccountsClient({
  initialAccounts,
}: {
  initialAccounts: AccountWithBalance[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // 篩選
  const [typeFilter, setTypeFilter] = useState<"all" | AccountType>("all");
  const [subFilter, setSubFilter] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);

  // Dialog
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editing, setEditing] = useState<AccountWithBalance | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const accounts = initialAccounts;

  // 空狀態
  if (accounts.length === 0) {
    return (
      <div className="bg-white/95 rounded-2xl shadow-lg p-8 text-center">
        <div className="text-5xl mb-3">🏦</div>
        <h2 className="text-xl font-bold text-slate-700 mb-2">
          尚未有任何帳戶
        </h2>
        <p className="text-slate-500 mb-6">
          一鍵載入 27 個常用預設帳戶（現金、銀行、餐飲、交通…）
        </p>
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await seedDefaultAccounts();
              if (r.ok) router.refresh();
              else setToast(`❌ ${r.error}`);
            })
          }
          className="bg-doraemon-500 hover:bg-doraemon-700 text-white font-semibold px-6 py-3 rounded-xl transition disabled:opacity-50"
        >
          {pending ? "載入中..." : "📦 一鍵載入預設帳戶"}
        </button>
        {toast && <p className="text-red-600 text-sm mt-3">{toast}</p>}
      </div>
    );
  }

  // 套用篩選
  const filtered = accounts.filter((a) => {
    if (!showInactive && !a.is_active) return false;
    if (typeFilter !== "all" && a.account_type !== typeFilter) return false;
    if (subFilter !== "all" && a.sub_type !== subFilter) return false;
    return true;
  });

  const grouped = groupAccountsWithParentTotals(filtered);

  // sub_type 選項（依 type filter）
  const subOptions =
    typeFilter !== "all"
      ? ACCOUNT_SUB_TYPES[typeFilter]
      : Array.from(new Set(Object.values(ACCOUNT_SUB_TYPES).flat()));

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="mb-4 bg-doraemon-50 border border-doraemon-300 text-doraemon-700 rounded-lg px-4 py-2 text-sm">
          {toast}
        </div>
      )}

      {/* 篩選 + 按鈕 */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">篩選類型</label>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as "all" | AccountType);
              setSubFilter("all");
            }}
            className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm"
          >
            <option value="all">（全部）</option>
            {ACCOUNT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-1">
            📂 子分類
          </label>
          <select
            value={subFilter}
            onChange={(e) => setSubFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm"
          >
            <option value="all">（全部）</option>
            {subOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600 pb-2">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          顯示已停用
        </label>

        <div className="ml-auto">
          <button
            onClick={() => {
              setEditing(null);
              setDialogMode("new");
            }}
            className="bg-doraemon-500 hover:bg-doraemon-700 text-white font-medium px-4 py-2 rounded-lg transition"
          >
            ➕ 新增帳戶
          </button>
        </div>
      </div>

      {/* 列表 */}
      <div className="bg-white/95 rounded-2xl shadow-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-3 font-medium">名稱</th>
              <th className="text-left px-4 py-3 font-medium">代碼</th>
              <th className="text-left px-4 py-3 font-medium">類型</th>
              <th className="text-left px-4 py-3 font-medium">子分類</th>
              <th className="text-right px-4 py-3 font-medium">
                現時餘額 (HKD)
              </th>
              <th className="text-center px-4 py-3 font-medium">啟用</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(({ account: a, depth, aggregatedBalance, isParent, childCount }) => (
              <tr
                key={a.code}
                className="border-t border-slate-100 hover:bg-doraemon-50/40"
              >
                <td className="px-4 py-2.5">
                  <span className={depth > 0 ? "text-slate-400" : ""}>
                    {depth > 0 && "　└ "}
                  </span>
                  <span>{a.icon} {a.name}</span>
                  {isParent && (
                    <span className="text-xs text-slate-400 ml-1">
                      （合計 {childCount} 子）
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-500">
                  {a.code}
                </td>
                <td className="px-4 py-2.5">
                  {ACCOUNT_TYPE_LABELS[a.account_type]}
                </td>
                <td className="px-4 py-2.5 text-slate-500">
                  {a.sub_type || "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                  {fmtMoney(isParent ? aggregatedBalance : a.balance)}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {a.is_active ? "✅" : "❌"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => {
                      setEditing(a);
                      setDialogMode("edit");
                    }}
                    className="text-doraemon-600 hover:text-doraemon-700 text-sm font-medium"
                  >
                    ✏️ 編輯
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {grouped.length === 0 && (
          <p className="text-center text-slate-400 py-8">
            無符合篩選條件嘅帳戶
          </p>
        )}
      </div>

      {/* Dialog */}
      {dialogMode && (
        <AccountDialog
          mode={dialogMode}
          editing={editing}
          allAccounts={accounts}
          onClose={() => setDialogMode(null)}
          onDone={(msg) => {
            setDialogMode(null);
            setToast(msg);
            router.refresh();
            setTimeout(() => setToast(null), 3000);
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// 新增 / 編輯 Dialog
// ============================================================
function AccountDialog({
  mode,
  editing,
  allAccounts,
  onClose,
  onDone,
}: {
  mode: "new" | "edit";
  editing: AccountWithBalance | null;
  allAccounts: AccountWithBalance[];
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const isEdit = mode === "edit";
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState(editing?.code ?? "");
  const [name, setName] = useState(editing?.name ?? "");
  const [accountType, setAccountType] = useState<AccountType>(
    editing?.account_type ?? "asset",
  );
  const [subType, setSubType] = useState(editing?.sub_type ?? "");
  const [parentCode, setParentCode] = useState(editing?.parent_code ?? "");
  const [opening, setOpening] = useState(editing?.opening_balance ?? 0);
  const [currency, setCurrency] = useState(editing?.currency ?? "HKD");
  const [icon, setIcon] = useState(editing?.icon ?? "");
  const [sortOrder, setSortOrder] = useState(editing?.sort_order ?? 0);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [isActive, setIsActive] = useState(editing?.is_active ?? true);

  // 父帳戶候選：同類型 + 頂層（無 parent）+ 非自己
  const parentCandidates = allAccounts.filter(
    (a) =>
      a.account_type === accountType &&
      !a.parent_code &&
      (!isEdit || a.code !== editing?.code),
  );
  // 若此帳戶自己已有子，不可設父
  const hasChildren = isEdit
    ? allAccounts.some((a) => a.parent_code === editing?.code)
    : false;

  const subOptions = ACCOUNT_SUB_TYPES[accountType];

  function save() {
    setError(null);
    startTransition(async () => {
      const r = await upsertAccount({
        code,
        name,
        account_type: accountType,
        sub_type: subType || null,
        parent_code: hasChildren ? null : parentCode || null,
        opening_balance: opening,
        currency,
        icon: icon || null,
        sort_order: sortOrder,
        notes: notes || null,
        is_active: isActive,
        isEdit,
      });
      if (r.ok) onDone(isEdit ? `✅ 已更新 ${code}` : `🎉 已建立 ${code}`);
      else setError(r.error ?? "失敗");
    });
  }

  function handleDelete() {
    if (!editing) return;
    setError(null);
    startTransition(async () => {
      const r = await deleteAccount(editing.code);
      if (r.ok) onDone(`🗑️ 已刪除 ${editing.code}`);
      else setError(r.error ?? "失敗");
    });
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800">
            {isEdit ? "✏️ 編輯帳戶" : "➕ 新增帳戶"}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="帳戶代碼">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={isEdit}
                placeholder="例：ZA_BANK"
                className="input disabled:bg-slate-100"
              />
            </Field>
            <Field label="圖示 emoji（選填）">
              <input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="🏦"
                className="input"
              />
            </Field>
          </div>

          <Field label="顯示名稱">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：ZA Bank"
              className="input"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="帳戶類型">
              <select
                value={accountType}
                onChange={(e) => {
                  setAccountType(e.target.value as AccountType);
                  setSubType("");
                  setParentCode("");
                }}
                disabled={isEdit}
                className="input disabled:bg-slate-100"
              >
                {ACCOUNT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="幣別">
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
            </Field>
          </div>

          {subOptions.length > 0 && (
            <Field label="📂 子分類">
              <select
                value={subType}
                onChange={(e) => setSubType(e.target.value)}
                className="input"
              >
                <option value="">（未分類）</option>
                {subOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {hasChildren ? (
            <Field label="🌳 父帳戶">
              <input
                disabled
                value="（此帳戶已有子帳戶，必須保持頂層）"
                className="input bg-slate-100 text-slate-400"
              />
            </Field>
          ) : (
            <Field label="🌳 父帳戶（選填）">
              <select
                value={parentCode}
                onChange={(e) => setParentCode(e.target.value)}
                className="input"
              >
                <option value="">（無 — 頂層帳戶）</option>
                {parentCandidates.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.icon} {a.name} ({a.code})
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="期初餘額">
              <input
                type="number"
                step="0.01"
                value={opening}
                onChange={(e) => setOpening(parseFloat(e.target.value) || 0)}
                className="input"
              />
            </Field>
            <Field label="排序（小→大）">
              <input
                type="number"
                value={sortOrder}
                onChange={(e) =>
                  setSortOrder(parseInt(e.target.value) || 0)
                }
                className="input"
              />
            </Field>
          </div>

          {isEdit && (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              啟用此帳戶
            </label>
          )}

          <Field label="備註">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="input"
            />
          </Field>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              ❌ {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={save}
              disabled={pending}
              className="flex-1 bg-doraemon-500 hover:bg-doraemon-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50"
            >
              {pending ? "處理中..." : isEdit ? "💾 儲存修改" : "✨ 建立帳戶"}
            </button>
            {isEdit && (
              <button
                onClick={handleDelete}
                disabled={pending}
                className="px-4 bg-red-50 hover:bg-red-100 text-red-700 font-medium rounded-lg border border-red-200 transition disabled:opacity-50"
              >
                🗑️
              </button>
            )}
          </div>
        </div>
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
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
