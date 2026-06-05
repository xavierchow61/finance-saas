"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES } from "@/lib/constants";
import type { Account, FxRate, PaymentAlias, ClosedPeriod } from "@/lib/types";
import {
  setFxRate,
  updateFxFromApi,
  deleteFxRate,
  setAlias,
  deleteAlias,
  togglePeriodLock,
} from "./actions";

type Tab = "fx" | "alias" | "lock";

interface Props {
  fxRates: FxRate[];
  aliases: PaymentAlias[];
  closedPeriods: ClosedPeriod[];
  payAccounts: Account[];
}

export default function SettingsClient({
  fxRates,
  aliases,
  closedPeriods,
  payAccounts,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("fx");
  const [msg, setMsg] = useState<string | null>(null);

  const nameByCode = new Map(
    payAccounts.map((a) => [a.code, `${a.icon ?? ""} ${a.name}`.trim()]),
  );

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(null), 3000);
  }

  return (
    <div className="p-6 md:p-10">
      <h1 className="text-2xl md:text-3xl font-bold text-doraemon-700 mb-1">
        ⚙️ 設定
      </h1>
      <p className="text-sm text-slate-600 mb-6">
        外幣匯率 · 付款方式對應 · 期間鎖定
      </p>

      {msg && (
        <div className="mb-4 bg-doraemon-50 border border-doraemon-300 text-doraemon-700 rounded-lg px-4 py-2 text-sm">
          {msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-5 w-fit">
        {(
          [
            ["fx", "💱 外幣匯率"],
            ["alias", "🔗 付款方式對應"],
            ["lock", "🔒 期間鎖定"],
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

      {tab === "fx" && (
        <FxTab fxRates={fxRates} onFlash={flash} router={router} />
      )}
      {tab === "alias" && (
        <AliasTab
          aliases={aliases}
          payAccounts={payAccounts}
          nameByCode={nameByCode}
          onFlash={flash}
          router={router}
        />
      )}
      {tab === "lock" && (
        <LockTab closedPeriods={closedPeriods} onFlash={flash} router={router} />
      )}
    </div>
  );
}

// ---------- 匯率 ----------
function FxTab({
  fxRates,
  onFlash,
  router,
}: {
  fxRates: FxRate[];
  onFlash: (m: string) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [curr, setCurr] = useState("USD");
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-700">外幣匯率（對 HKD）</h2>
        <button
          onClick={async () => {
            setBusy(true);
            const r = await updateFxFromApi();
            setBusy(false);
            onFlash(r.ok ? `🌐 ${r.info}` : `❌ ${r.error}`);
            if (r.ok) router.refresh();
          }}
          disabled={busy}
          className="bg-doraemon-500 hover:bg-doraemon-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {busy ? "更新中…" : "🌐 從 API 更新"}
        </button>
      </div>

      {/* 手動新增 */}
      <div className="flex flex-wrap items-end gap-3 mb-4 pb-4 border-b border-slate-200">
        <div>
          <label className="block text-xs text-slate-500 mb-1">幣別</label>
          <select
            className="input"
            value={curr}
            onChange={(e) => setCurr(e.target.value)}
          >
            {CURRENCIES.filter((c) => c !== "HKD").map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">
            1 {curr} = ? HKD
          </label>
          <input
            type="number"
            step="0.0001"
            className="input"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </div>
        <button
          onClick={async () => {
            const r = await setFxRate({
              currency: curr,
              rate_to_hkd: Number(rate) || 0,
              as_of_date: new Date().toISOString().slice(0, 10),
            });
            onFlash(r.ok ? "✅ 已儲存匯率" : `❌ ${r.error}`);
            if (r.ok) {
              setRate("");
              router.refresh();
            }
          }}
          className="bg-doraemon-500 hover:bg-doraemon-700 text-white text-sm px-4 py-2 rounded-lg"
        >
          ➕ 新增
        </button>
      </div>

      {fxRates.length === 0 ? (
        <p className="text-slate-400 text-sm py-4">
          尚未設定匯率。HKD 預設 1.0。可撳「從 API 更新」一鍵載入。
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-3">幣別</th>
              <th className="py-2 pr-3 text-right">對 HKD</th>
              <th className="py-2 pr-3">生效日</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {fxRates.map((f) => (
              <tr key={`${f.currency}-${f.as_of_date}`} className="border-b border-slate-100">
                <td className="py-2 pr-3 font-medium">{f.currency}</td>
                <td className="py-2 pr-3 text-right font-mono">
                  {f.rate_to_hkd.toFixed(4)}
                </td>
                <td className="py-2 pr-3 text-slate-500">{f.as_of_date}</td>
                <td className="py-2 text-right">
                  <button
                    onClick={async () => {
                      await deleteFxRate(f.currency, f.as_of_date);
                      router.refresh();
                    }}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------- 付款方式對應 ----------
function AliasTab({
  aliases,
  payAccounts,
  nameByCode,
  onFlash,
  router,
}: {
  aliases: PaymentAlias[];
  payAccounts: Account[];
  nameByCode: Map<string, string>;
  onFlash: (m: string) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [kw, setKw] = useState("");
  const [acc, setAcc] = useState(payAccounts[0]?.code ?? "");

  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-6">
      <h2 className="text-lg font-bold text-slate-700 mb-1">付款方式對應</h2>
      <p className="text-xs text-slate-500 mb-4">
        OCR 提取嘅付款字眼 → 對應帳戶（例：PayMe → PAYME）
      </p>

      <div className="flex flex-wrap items-end gap-3 mb-4 pb-4 border-b border-slate-200">
        <div className="flex-1 min-w-40">
          <label className="block text-xs text-slate-500 mb-1">
            關鍵字（模糊匹配）
          </label>
          <input
            className="input"
            placeholder="例：PayMe / HSBC / Visa"
            value={kw}
            onChange={(e) => setKw(e.target.value)}
          />
        </div>
        <div className="flex-1 min-w-40">
          <label className="block text-xs text-slate-500 mb-1">對應帳戶</label>
          <select
            className="input"
            value={acc}
            onChange={(e) => setAcc(e.target.value)}
          >
            {payAccounts.map((a) => (
              <option key={a.code} value={a.code}>
                {a.icon ?? ""} {a.name} ({a.code})
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={async () => {
            const r = await setAlias({ keyword: kw, account_code: acc });
            onFlash(r.ok ? "✅ 已儲存對應" : `❌ ${r.error}`);
            if (r.ok) {
              setKw("");
              router.refresh();
            }
          }}
          className="bg-doraemon-500 hover:bg-doraemon-700 text-white text-sm px-4 py-2 rounded-lg"
        >
          ➕ 新增
        </button>
      </div>

      {aliases.length === 0 ? (
        <p className="text-slate-400 text-sm py-4">尚未設定任何對應。</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-3">關鍵字</th>
              <th className="py-2 pr-3">對應帳戶</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {aliases.map((a) => (
              <tr key={a.keyword} className="border-b border-slate-100">
                <td className="py-2 pr-3 font-medium">{a.keyword}</td>
                <td className="py-2 pr-3">
                  {nameByCode.get(a.account_code) ?? a.account_code}
                </td>
                <td className="py-2 text-right">
                  <button
                    onClick={async () => {
                      await deleteAlias(a.keyword);
                      router.refresh();
                    }}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------- 期間鎖定 ----------
function LockTab({
  closedPeriods,
  onFlash,
  router,
}: {
  closedPeriods: ClosedPeriod[];
  onFlash: (m: string) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));

  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-6">
      <h2 className="text-lg font-bold text-slate-700 mb-1">期間鎖定</h2>
      <p className="text-xs text-slate-500 mb-4">
        鎖定月份後，該月分錄不應再修改（提示用途）
      </p>

      <div className="flex items-end gap-3 mb-4 pb-4 border-b border-slate-200">
        <div>
          <label className="block text-xs text-slate-500 mb-1">
            月份 (YYYY-MM)
          </label>
          <input
            type="month"
            className="input"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </div>
        <button
          onClick={async () => {
            const r = await togglePeriodLock(period, false);
            onFlash(r.ok ? `🔒 已鎖定 ${period}` : `❌ ${r.error}`);
            if (r.ok) router.refresh();
          }}
          className="bg-doraemon-500 hover:bg-doraemon-700 text-white text-sm px-4 py-2 rounded-lg"
        >
          🔒 鎖定此月份
        </button>
      </div>

      {closedPeriods.length === 0 ? (
        <p className="text-slate-400 text-sm py-4">尚無鎖定期間。</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {closedPeriods.map((c) => (
            <div
              key={c.period}
              className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2"
            >
              <span className="text-sm font-medium">🔒 {c.period}</span>
              <button
                onClick={async () => {
                  const r = await togglePeriodLock(c.period, true);
                  onFlash(r.ok ? `🔓 已解鎖 ${c.period}` : `❌ ${r.error}`);
                  if (r.ok) router.refresh();
                }}
                className="text-xs text-doraemon-600 hover:text-doraemon-700"
              >
                解鎖
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
