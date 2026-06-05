import { createClient } from "@/lib/supabase/server";
import type { Account, FxRate, PaymentAlias, ClosedPeriod } from "@/lib/types";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const supabase = await createClient();

  const [{ data: fx }, { data: aliases }, { data: closed }, { data: accounts }] =
    await Promise.all([
      supabase
        .from("fx_rates")
        .select("*")
        .order("as_of_date", { ascending: false }),
      supabase.from("payment_aliases").select("*").order("keyword"),
      supabase
        .from("closed_periods")
        .select("*")
        .order("period", { ascending: false }),
      supabase
        .from("accounts")
        .select("*")
        .eq("is_active", true)
        .in("account_type", ["asset", "liability"])
        .order("sort_order"),
    ]);

  return (
    <SettingsClient
      fxRates={(fx ?? []) as FxRate[]}
      aliases={(aliases ?? []) as PaymentAlias[]}
      closedPeriods={(closed ?? []) as ClosedPeriod[]}
      payAccounts={(accounts ?? []) as Account[]}
    />
  );
}
