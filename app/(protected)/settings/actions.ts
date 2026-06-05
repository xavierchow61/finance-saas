"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface ActionResult {
  ok: boolean;
  error?: string;
  info?: string;
}

// ============================================================
// 匯率 — 手動 upsert
// ============================================================
export async function setFxRate(input: {
  currency: string;
  rate_to_hkd: number;
  as_of_date: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未登入" };
  if (!input.currency || input.rate_to_hkd <= 0)
    return { ok: false, error: "幣別 / 匯率無效" };

  const { error } = await supabase.from("fx_rates").upsert(
    {
      user_id: user.id,
      currency: input.currency.toUpperCase(),
      rate_to_hkd: input.rate_to_hkd,
      as_of_date: input.as_of_date,
    },
    { onConflict: "user_id,currency,as_of_date" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

// 從 frankfurter.app 免費 API（ECB 數據）批量更新
export async function updateFxFromApi(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未登入" };

  const SUPPORTED = ["USD", "JPY", "CNY", "EUR", "GBP", "AUD", "SGD", "CAD", "KRW", "THB"];
  try {
    const symbols = SUPPORTED.join(",");
    const res = await fetch(
      `https://api.frankfurter.app/latest?base=HKD&symbols=${symbols}`,
      { cache: "no-store" },
    );
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = (await res.json()) as { rates: Record<string, number> };
    const today = new Date().toISOString().slice(0, 10);

    const rows = Object.entries(data.rates)
      .filter(([, perHkd]) => perHkd > 0)
      .map(([ccy, perHkd]) => ({
        user_id: user.id,
        currency: ccy,
        rate_to_hkd: Math.round((1 / perHkd) * 1e6) / 1e6,
        as_of_date: today,
      }));

    const { error } = await supabase
      .from("fx_rates")
      .upsert(rows, { onConflict: "user_id,currency,as_of_date" });
    if (error) return { ok: false, error: error.message };

    revalidatePath("/settings");
    return { ok: true, info: `已更新 ${rows.length} 個匯率（截至 ${today}）` };
  } catch (ex: unknown) {
    return {
      ok: false,
      error: `API 取得失敗：${ex instanceof Error ? ex.message : String(ex)}`,
    };
  }
}

export async function deleteFxRate(
  currency: string,
  asOfDate: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未登入" };
  await supabase
    .from("fx_rates")
    .delete()
    .eq("currency", currency)
    .eq("as_of_date", asOfDate);
  revalidatePath("/settings");
  return { ok: true };
}

// ============================================================
// 付款方式對應
// ============================================================
export async function setAlias(input: {
  keyword: string;
  account_code: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未登入" };
  if (!input.keyword.trim()) return { ok: false, error: "關鍵字不能為空" };

  const { error } = await supabase.from("payment_aliases").upsert(
    {
      user_id: user.id,
      keyword: input.keyword.trim().toLowerCase(),
      account_code: input.account_code,
    },
    { onConflict: "user_id,keyword" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function deleteAlias(keyword: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未登入" };
  await supabase.from("payment_aliases").delete().eq("keyword", keyword);
  revalidatePath("/settings");
  return { ok: true };
}

// ============================================================
// 期間鎖定
// ============================================================
export async function togglePeriodLock(
  period: string,
  locked: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未登入" };

  if (locked) {
    // 已鎖 → 解鎖（刪除）
    await supabase.from("closed_periods").delete().eq("period", period);
  } else {
    if (!/^\d{4}-\d{2}$/.test(period))
      return { ok: false, error: "期間格式應為 YYYY-MM" };
    const { error } = await supabase
      .from("closed_periods")
      .insert({ user_id: user.id, period });
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/settings");
  return { ok: true };
}
