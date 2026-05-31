import { createClient } from "@/lib/supabase/server";
import { calcAccountBalances } from "@/lib/finance";
import type { Account, JournalLine, JournalEntryWithLines } from "@/lib/types";
import LedgerClient from "./LedgerClient";

export default async function LedgerPage() {
  const supabase = await createClient();

  const [{ data: entries }, { data: accounts }, { data: allLines }] =
    await Promise.all([
      supabase
        .from("journal_entries")
        .select("*, journal_lines(*)")
        .order("entry_date", { ascending: false })
        .order("id", { ascending: false })
        .limit(100),
      supabase.from("accounts").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("journal_lines").select("account_code, debit, credit"),
    ]);

  const withBalances = calcAccountBalances(
    (accounts ?? []) as Account[],
    (allLines ?? []) as JournalLine[],
  );

  return (
    <div className="p-6 md:p-10">
      <h1 className="text-2xl md:text-3xl font-bold text-doraemon-700 mb-1">
        💰 個人記賬
      </h1>
      <p className="text-sm text-slate-600 mb-6">
        雙式記賬（Double-Entry Ledger）
      </p>
      <LedgerClient
        entries={(entries ?? []) as JournalEntryWithLines[]}
        accounts={withBalances}
      />
    </div>
  );
}
