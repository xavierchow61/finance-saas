import { createClient } from "@/lib/supabase/server";
import { calcAccountBalances } from "@/lib/finance";
import type { Account, JournalLine } from "@/lib/types";
import AccountsClient from "./AccountsClient";

export default async function AccountsPage() {
  const supabase = await createClient();

  const [{ data: accounts }, { data: lines }] = await Promise.all([
    supabase.from("accounts").select("*").order("sort_order"),
    supabase.from("journal_lines").select("account_code, debit, credit"),
  ]);

  const withBalances = calcAccountBalances(
    (accounts ?? []) as Account[],
    (lines ?? []) as JournalLine[],
  );

  return (
    <div className="p-6 md:p-10">
      <h1 className="text-2xl md:text-3xl font-bold text-doraemon-700 mb-1">
        🏦 帳戶管理
      </h1>
      <p className="text-sm text-slate-600 mb-6">
        管理所有帳戶：現金、銀行、信用卡、消費類別、收入來源
      </p>
      <AccountsClient initialAccounts={withBalances} />
    </div>
  );
}
