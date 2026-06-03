"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

// ============================================================
// 設定 / 更新 / 刪除預算（upsert by account_code + period）
// ============================================================
export async function setBudget(input: {
  account_code: string;
  period: string; // YYYY-MM
  amount: number | null; // null 或 0 = 刪除
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未登入" };

  // amount 為空 / 0 → 刪除預算
  if (input.amount == null || input.amount <= 0) {
    await supabase
      .from("budgets")
      .delete()
      .eq("account_code", input.account_code)
      .eq("period", input.period);
    revalidatePath("/budget");
    return { ok: true };
  }

  const { error } = await supabase.from("budgets").upsert(
    {
      user_id: user.id,
      account_code: input.account_code,
      period: input.period,
      amount: input.amount,
    },
    { onConflict: "user_id,account_code,period" },
  );

  if (error) return { ok: false, error: error.message };
  revalidatePath("/budget");
  return { ok: true };
}

// 批量設定多個預算（一次過儲存）
export async function setBudgetsBatch(
  period: string,
  entries: { account_code: string; amount: number }[],
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未登入" };

  const toUpsert = entries
    .filter((e) => e.amount > 0)
    .map((e) => ({
      user_id: user.id,
      account_code: e.account_code,
      period,
      amount: e.amount,
    }));
  const toDelete = entries
    .filter((e) => e.amount <= 0)
    .map((e) => e.account_code);

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from("budgets")
      .upsert(toUpsert, { onConflict: "user_id,account_code,period" });
    if (error) return { ok: false, error: error.message };
  }
  if (toDelete.length > 0) {
    await supabase
      .from("budgets")
      .delete()
      .eq("period", period)
      .in("account_code", toDelete);
  }

  revalidatePath("/budget");
  return { ok: true };
}
