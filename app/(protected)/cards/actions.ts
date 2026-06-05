"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

// 新增 / 更新信用卡資料（upsert by account_code）
export async function upsertCard(input: {
  account_code: string;
  card_last4?: string | null;
  credit_limit?: number | null;
  statement_day?: number | null;
  due_day?: number | null;
  interest_rate?: number | null; // 0.32 = 32%
  annual_fee?: number | null;
  rewards?: string | null;
  rewards_rate?: number | null;
  rewards_type?: string | null;
  notes?: string | null;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未登入" };
  if (!input.account_code) return { ok: false, error: "請選擇對應帳戶" };

  const { error } = await supabase.from("credit_cards").upsert(
    {
      user_id: user.id,
      account_code: input.account_code,
      card_last4: input.card_last4 || null,
      credit_limit: input.credit_limit ?? null,
      statement_day: input.statement_day ?? null,
      due_day: input.due_day ?? null,
      interest_rate: input.interest_rate ?? null,
      annual_fee: input.annual_fee ?? null,
      rewards: input.rewards || null,
      rewards_rate: input.rewards_rate ?? null,
      rewards_type: input.rewards_type || null,
      notes: input.notes || null,
    },
    { onConflict: "user_id,account_code" },
  );

  if (error) return { ok: false, error: error.message };
  revalidatePath("/cards");
  return { ok: true };
}

export async function deleteCard(accountCode: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未登入" };

  const { error } = await supabase
    .from("credit_cards")
    .delete()
    .eq("account_code", accountCode);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/cards");
  return { ok: true };
}
