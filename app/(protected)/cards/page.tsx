import { createClient } from "@/lib/supabase/server";
import { calcAccountBalances } from "@/lib/finance";
import type { Account, CreditCard, JournalLine } from "@/lib/types";
import CardsClient from "./CardsClient";

export default async function CardsPage() {
  const supabase = await createClient();

  const [{ data: cards }, { data: accounts }, { data: lines }] =
    await Promise.all([
      supabase.from("credit_cards").select("*"),
      supabase
        .from("accounts")
        .select("*")
        .eq("is_active", true)
        .eq("account_type", "liability")
        .order("sort_order"),
      supabase.from("journal_lines").select("account_code, debit, credit"),
    ]);

  const liabAccs = (accounts ?? []) as Account[];
  const withBal = calcAccountBalances(liabAccs, (lines ?? []) as JournalLine[]);
  const balMap = new Map(withBal.map((a) => [a.code, a.balance]));

  // 已建卡 vs 可加卡（未有 credit_cards 紀錄嘅 liability）
  const cardCodes = new Set((cards ?? []).map((c: CreditCard) => c.account_code));
  const available = liabAccs.filter((a) => !cardCodes.has(a.code));

  return (
    <CardsClient
      cards={(cards ?? []) as CreditCard[]}
      liabAccounts={liabAccs}
      availableAccounts={available}
      balances={Object.fromEntries(balMap)}
    />
  );
}
