"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

// ============================================================
// 一鍵收款：標記已報銷 + 建收款分錄
//   Dr <收款帳戶>（銀行/現金） 金額
//   Cr AR_REIMBURSE（沖銷應收）  金額
// ============================================================
export async function markReceived(input: {
  invoiceId: number;
  amount: number;
  receivedAccount: string;
  receivedDate: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未登入" };

  if (input.amount <= 0) return { ok: false, error: "金額必須大於零" };

  // 確認收款帳戶 + AR_REIMBURSE 都存在
  const { data: accs } = await supabase
    .from("accounts")
    .select("code")
    .in("code", [input.receivedAccount, "AR_REIMBURSE"]);
  const codeSet = new Set((accs ?? []).map((a) => a.code));
  if (!codeSet.has("AR_REIMBURSE")) {
    return {
      ok: false,
      error: "缺少 AR_REIMBURSE（公司報銷應收）帳戶，請先去帳戶管理建立",
    };
  }
  if (!codeSet.has(input.receivedAccount)) {
    return { ok: false, error: "收款帳戶不存在" };
  }

  // 1. 建收款分錄
  const { data: entry, error: entryErr } = await supabase
    .from("journal_entries")
    .insert({
      user_id: user.id,
      entry_date: input.receivedDate,
      description: `報銷收款 #${input.invoiceId}`,
      invoice_id: input.invoiceId,
      currency: "HKD",
    })
    .select("id")
    .single();

  if (entryErr || !entry)
    return { ok: false, error: entryErr?.message ?? "建立收款分錄失敗" };

  const { error: linesErr } = await supabase.from("journal_lines").insert([
    {
      user_id: user.id,
      entry_id: entry.id,
      account_code: input.receivedAccount,
      debit: input.amount,
      credit: 0,
    },
    {
      user_id: user.id,
      entry_id: entry.id,
      account_code: "AR_REIMBURSE",
      debit: 0,
      credit: input.amount,
    },
  ]);
  if (linesErr) {
    await supabase.from("journal_entries").delete().eq("id", entry.id);
    return { ok: false, error: linesErr.message };
  }

  // 2. 標記已報銷
  await supabase
    .from("invoices")
    .update({ reimbursed: true })
    .eq("id", input.invoiceId);

  revalidatePath("/reimburse");
  revalidatePath("/ledger");
  revalidatePath("/dashboard");
  revalidatePath("/invoices");
  return { ok: true };
}

// 撤銷已收款（只改狀態，唔自動刪分錄，提示用戶手動處理）
export async function undoReceived(invoiceId: number): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未登入" };

  const { error } = await supabase
    .from("invoices")
    .update({ reimbursed: false })
    .eq("id", invoiceId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/reimburse");
  return { ok: true };
}
