import { createClient } from "@/lib/supabase/server";
import type { Account, Invoice } from "@/lib/types";
import InvoicesClient from "./InvoicesClient";

export default async function InvoicesPage() {
  const supabase = await createClient();

  const [{ data: invoices }, { data: accounts }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*")
      .order("purchase_date", { ascending: false })
      .order("id", { ascending: false }),
    supabase
      .from("accounts")
      .select("*")
      .eq("is_active", true)
      .in("account_type", ["asset", "liability"])
      .order("sort_order"),
  ]);

  return (
    <InvoicesClient
      invoices={(invoices ?? []) as Invoice[]}
      paymentAccounts={(accounts ?? []) as Account[]}
    />
  );
}
