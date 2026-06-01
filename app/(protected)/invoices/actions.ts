"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { CATEGORY_TO_ACCOUNT } from "@/lib/constants";
import type { ExpenseType, InvoiceItem } from "@/lib/types";

export interface ActionResult {
  ok: boolean;
  error?: string;
  invoiceId?: number;
}

// ============================================================
// 儲存單據 + （可選）自動建雙式分錄
// ============================================================
// 自動入賬規則：
//   Dr <支出帳戶>（依 category 對應）金額
//   Cr <付款帳戶>（用戶揀）金額
// 公司報銷：Dr AR_REIMBURSE（應收）/ Cr 付款帳戶
// ============================================================
export async function saveInvoice(input: {
  purchase_date: string | null;
  store_name: string | null;
  category: string | null;
  expense_type: ExpenseType;
  total_amount: number | null;
  currency: string;
  payment_method: string | null;
  tax: number | null;
  receipt_number: string | null;
  items: InvoiceItem[];
  notes: string | null;
  // 入賬選項
  autoPost: boolean;
  paymentAccount: string | null; // 貸方帳戶（付款來源）
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未登入" };

  if (!input.total_amount || input.total_amount <= 0) {
    return { ok: false, error: "金額必須大於零" };
  }

  // 1. 插入 invoice
  const { data: inv, error: invErr } = await supabase
    .from("invoices")
    .insert({
      user_id: user.id,
      purchase_date: input.purchase_date,
      store_name: input.store_name,
      category: input.category,
      expense_type: input.expense_type,
      reimbursed: false,
      total_amount: input.total_amount,
      currency: input.currency || "HKD",
      payment_method: input.payment_method,
      items_json: input.items,
      tax: input.tax,
      receipt_number: input.receipt_number,
      notes: input.notes,
      extracted_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (invErr || !inv) {
    return { ok: false, error: invErr?.message ?? "儲存單據失敗" };
  }

  // 2. 自動入賬（如選擇）
  if (input.autoPost && input.paymentAccount) {
    // 借方：公司報銷 → AR_REIMBURSE；否則依 category
    const drAccount =
      input.expense_type === "公司報銷"
        ? "AR_REIMBURSE"
        : CATEGORY_TO_ACCOUNT[input.category ?? ""] ?? "OTHER_EXPENSE";

    // 確認兩個帳戶都存在（避免 FK 錯誤）
    const { data: accs } = await supabase
      .from("accounts")
      .select("code")
      .in("code", [drAccount, input.paymentAccount]);
    const codeSet = new Set((accs ?? []).map((a) => a.code));

    if (!codeSet.has(drAccount) || !codeSet.has(input.paymentAccount)) {
      // 入賬失敗但 invoice 已存 → 提示但唔當整體失敗
      revalidatePath("/invoices");
      return {
        ok: true,
        invoiceId: inv.id,
        error:
          `單據已儲存，但自動入賬跳過（帳戶 ${drAccount} 或 ` +
          `${input.paymentAccount} 不存在，請先建立）`,
      };
    }

    const { data: entry, error: entryErr } = await supabase
      .from("journal_entries")
      .insert({
        user_id: user.id,
        entry_date: input.purchase_date ?? new Date().toISOString().slice(0, 10),
        description: `${input.store_name ?? "單據"}（${input.category ?? ""}）`,
        invoice_id: inv.id,
        currency: input.currency || "HKD",
      })
      .select("id")
      .single();

    if (!entryErr && entry) {
      await supabase.from("journal_lines").insert([
        {
          user_id: user.id,
          entry_id: entry.id,
          account_code: drAccount,
          debit: input.total_amount,
          credit: 0,
        },
        {
          user_id: user.id,
          entry_id: entry.id,
          account_code: input.paymentAccount,
          debit: 0,
          credit: input.total_amount,
        },
      ]);
    }
  }

  revalidatePath("/invoices");
  revalidatePath("/ledger");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  return { ok: true, invoiceId: inv.id };
}

// ============================================================
// 刪除單據（連帶刪相關分錄）
// ============================================================
export async function deleteInvoice(invoiceId: number): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未登入" };

  // 先刪相關 journal_entries（cascade 刪 lines）
  await supabase.from("journal_entries").delete().eq("invoice_id", invoiceId);

  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", invoiceId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/invoices");
  revalidatePath("/ledger");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ============================================================
// 切換報銷狀態
// ============================================================
export async function toggleReimbursed(
  invoiceId: number,
  current: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未登入" };

  const { error } = await supabase
    .from("invoices")
    .update({ reimbursed: !current })
    .eq("id", invoiceId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/invoices");
  return { ok: true };
}
