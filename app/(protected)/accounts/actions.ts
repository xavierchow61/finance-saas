"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { DEFAULT_ACCOUNTS } from "@/lib/constants";
import type { AccountType } from "@/lib/types";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

// ============================================================
// 新增 / 更新帳戶（upsert by code）
// ============================================================
export async function upsertAccount(input: {
  code: string;
  name: string;
  account_type: AccountType;
  sub_type?: string | null;
  parent_code?: string | null;
  opening_balance?: number;
  currency?: string;
  icon?: string | null;
  sort_order?: number;
  notes?: string | null;
  is_active?: boolean;
  isEdit?: boolean;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未登入" };

  const code = input.code.trim().toUpperCase();
  if (!code) return { ok: false, error: "代碼不能為空" };
  if (!input.name.trim()) return { ok: false, error: "名稱不能為空" };

  // 新增時檢查 code 是否已存在
  if (!input.isEdit) {
    const { data: existing } = await supabase
      .from("accounts")
      .select("code")
      .eq("code", code)
      .maybeSingle();
    if (existing) return { ok: false, error: `代碼「${code}」已存在` };
  }

  const row = {
    user_id: user.id,
    code,
    name: input.name.trim(),
    account_type: input.account_type,
    sub_type: input.sub_type || null,
    parent_code: input.parent_code || null,
    opening_balance: input.opening_balance ?? 0,
    currency: input.currency || "HKD",
    icon: input.icon || null,
    sort_order: input.sort_order ?? 0,
    notes: input.notes || null,
    is_active: input.is_active ?? true,
  };

  const { error } = await supabase
    .from("accounts")
    .upsert(row, { onConflict: "user_id,code" });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ============================================================
// 刪除帳戶（如有分錄關聯則拒絕）
// ============================================================
export async function deleteAccount(code: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未登入" };

  // 檢查有冇 journal_lines 用緊
  const { count } = await supabase
    .from("journal_lines")
    .select("*", { count: "exact", head: true })
    .eq("account_code", code);

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `此帳戶有 ${count} 筆分錄關聯，不可刪除。建議改為「停用」。`,
    };
  }

  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("code", code);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ============================================================
// 一鍵載入預設帳戶（只插入未存在嘅）
// ============================================================
export async function seedDefaultAccounts(): Promise<
  ActionResult & { inserted?: number }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未登入" };

  const rows = DEFAULT_ACCOUNTS.map((a) => ({
    user_id: user.id,
    code: a.code,
    name: a.name,
    account_type: a.account_type,
    sub_type: a.sub_type || null,
    icon: a.icon || null,
    sort_order: a.sort_order,
  }));

  // upsert ON CONFLICT DO NOTHING（ignoreDuplicates）
  const { error } = await supabase
    .from("accounts")
    .upsert(rows, { onConflict: "user_id,code", ignoreDuplicates: true });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return { ok: true, inserted: rows.length };
}
