import { createClient } from "@/lib/supabase/server";
import type { Loan } from "@/lib/types";
import LoansClient from "./LoansClient";

export default async function LoansPage() {
  const supabase = await createClient();
  const { data: loans } = await supabase
    .from("loans")
    .select("*")
    .order("created_at", { ascending: false });

  return <LoansClient loans={(loans ?? []) as Loan[]} />;
}
