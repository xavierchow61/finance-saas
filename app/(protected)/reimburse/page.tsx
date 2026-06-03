import { createClient } from "@/lib/supabase/server";
import type { Account, Invoice } from "@/lib/types";
import ReimburseClient from "./ReimburseClient";

export default async function ReimbursePage() {
  const supabase = await createClient();

  const [{ data: invoices }, { data: accounts }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*")
      .eq("expense_type", "公司報銷")
      .order("purchase_date", { ascending: false }),
    supabase
      .from("accounts")
      .select("*")
      .eq("is_active", true)
      .eq("account_type", "asset")
      .order("sort_order"),
  ]);

  return (
    <ReimburseClient
      invoices={(invoices ?? []) as Invoice[]}
      assetAccounts={(accounts ?? []) as Account[]}
    />
  );
}
