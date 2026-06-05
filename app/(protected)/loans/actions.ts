"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { calcEmi } from "@/lib/finance";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function upsertLoan(input: {
  id?: number;
  name: string;
  loan_type: string;
  bank?: string | null;
  principal: number;
  interest_rate: number; // 0.045 = 4.5%
  term_months: number;
  start_date: string;
  due_day?: number | null;
  notes?: string | null;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未登入" };

  if (!input.name.trim()) return { ok: false, error: "名稱不能為空" };
  if (input.principal <= 0) return { ok: false, error: "本金必須大於零" };
  if (input.term_months <= 0) return { ok: false, error: "期數必須大於零" };

  const monthly = calcEmi(
    input.principal,
    input.interest_rate,
    input.term_months,
  );

  const payload = {
    user_id: user.id,
    name: input.name.trim(),
    loan_type: input.loan_type,
    bank: input.bank || null,
    principal: input.principal,
    interest_rate: input.interest_rate,
    term_months: input.term_months,
    monthly_payment: Math.round(monthly * 100) / 100,
    start_date: input.start_date,
    due_day: input.due_day ?? null,
    notes: input.notes || null,
  };

  if (input.id) {
    const { error } = await supabase
      .from("loans")
      .update(payload)
      .eq("id", input.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("loans").insert(payload);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/loans");
  return { ok: true };
}

export async function deleteLoan(id: number): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未登入" };

  const { error } = await supabase.from("loans").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/loans");
  return { ok: true };
}
