"use client";

import { useState } from "react";
import type { AccountWithBalance } from "@/lib/types";

// ============================================================
// 級聯帳戶選擇器（父 → 子）
// ============================================================
export default function CascadePicker({
  label,
  accounts,
  value,
  onChange,
}: {
  label: string;
  accounts: AccountWithBalance[];
  value: string;
  onChange: (code: string) => void;
}) {
  const codeSet = new Set(accounts.map((a) => a.code));
  const topLevel = accounts.filter(
    (a) => !a.parent_code || !codeSet.has(a.parent_code),
  );
  const childrenOf = (parentCode: string) =>
    accounts.filter((a) => a.parent_code === parentCode);

  // 由 value 反推父
  const selectedAcc = accounts.find((a) => a.code === value);
  const initialParent: string = selectedAcc
    ? selectedAcc.parent_code && codeSet.has(selectedAcc.parent_code)
      ? selectedAcc.parent_code
      : selectedAcc.code
    : "";
  const [parent, setParent] = useState<string>(initialParent);

  const children = parent ? childrenOf(parent) : [];

  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label}
      </label>
      <select
        value={parent}
        onChange={(e) => {
          setParent(e.target.value);
          onChange(e.target.value); // 預設選父本身
        }}
        className="input mb-1"
      >
        <option value="">（選擇父帳戶）</option>
        {topLevel.map((a) => (
          <option key={a.code} value={a.code}>
            {a.icon} {a.name} ({a.code})
          </option>
        ))}
      </select>
      {children.length > 0 && (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input"
        >
          <option value={parent}>🔑 {parent}（父本身）</option>
          {children.map((c) => (
            <option key={c.code} value={c.code}>
              　└ {c.icon} {c.name} ({c.code})
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
