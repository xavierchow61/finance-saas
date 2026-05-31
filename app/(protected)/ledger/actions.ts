"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

// ============================================================
// 新增雙式分錄（Dr / Cr）
// ============================================================
export async function createEntry(input: {
  entry_date: string;
  description: string;
  currency: string;
  from_account: string; // 借方 Dr
  to_account: string; // 貸方 Cr
  amount: number;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未登入" };

  if (input.amount <= 0) return { ok: false, error: "金額必須大於零" };
  if (!input.from_account || !input.to_account)
    return { ok: false, error: "請選擇借方與貸方帳戶" };
  if (input.from_account === input.to_account)
    return { ok: false, error: "借方與貸方不能是同一帳戶" };

  // 1. 插入 journal_entries header，攞返 id
  const { data: entry, error: entryErr } = await supabase
    .from("journal_entries")
    .insert({
      user_id: user.id,
      entry_date: input.entry_date,
      description:
        input.description ||
        `手動分錄：${input.from_account} → ${input.to_account}`,
      currency: input.currency || "HKD",
    })
    .select("id")
    .single();

  if (entryErr || !entry)
    return { ok: false, error: entryErr?.message ?? "建立分錄失敗" };

  // 2. 插入 2 條 journal_lines
  const { error: linesErr } = await supabase.from("journal_lines").insert([
    {
      user_id: user.id,
      entry_id: entry.id,
      account_code: input.from_account,
      debit: input.amount,
      credit: 0,
    },
    {
      user_id: user.id,
      entry_id: entry.id,
      account_code: input.to_account,
      debit: 0,
      credit: input.amount,
    },
  ]);

  if (linesErr) {
    // rollback header（手動，因為兩個 insert 唔係 transaction）
    await supabase.from("journal_entries").delete().eq("id", entry.id);
    return { ok: false, error: linesErr.message };
  }

  revalidatePath("/ledger");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  return { ok: true };
}

// ============================================================
// 刪除分錄（cascade 刪 lines）
// ============================================================
export async function deleteEntry(entryId: number): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未登入" };

  const { error } = await supabase
    .from("journal_entries")
    .delete()
    .eq("id", entryId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/ledger");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  return { ok: true };
}
