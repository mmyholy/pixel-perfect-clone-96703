import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Asset } from "@/lib/saveflow";

export type Goal = {
  id: string;
  name: string;
  percentage: number;
  asset: Asset;
  target_amount: number | null;
  maturity_date: string;
  interest_rate: number;
  principal_ngn: number;
  units: number;
  status: "active" | "withdrawn";
  created_at: string;
};

export type Tx = {
  id: string;
  goal_id: string | null;
  type: "inflow" | "allocation" | "withdrawal" | "penalty" | "interest";
  amount_ngn: number;
  units: number | null;
  asset: Asset | null;
  description: string;
  created_at: string;
};

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async () => {
    const { data: auth, error: authError } =
      await supabase.auth.getUser();

    if (authError) throw authError;
    if (!auth.user) throw new Error("Please sign in again");

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", auth.user.id)
      .single();

    if (error) throw error;

    return {
      ...data,
      full_name: data.full_name ?? "",
      phone: data.phone ?? "",
      available_balance: Number(data.available_balance ?? 0),
      email: auth.user.email ?? "",
    };
  },
});

export const goalsQuery = queryOptions({
  queryKey: ["goals"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("goals")
      .select("*")
      .order("created_at");

    if (error) throw error;

    return (data ?? []).map((g) => ({
      ...g,
      percentage: Number(g.percentage),
      principal_ngn: Number(g.principal_ngn),
      units: Number(g.units),
      interest_rate: Number(g.interest_rate),
      target_amount:
        g.target_amount == null ? null : Number(g.target_amount),
    })) as Goal[];
  },
});

export const txQuery = queryOptions({
  queryKey: ["transactions"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) throw error;

    return (data ?? []).map((t) => ({
      ...t,
      amount_ngn: Number(t.amount_ngn),
      units: t.units == null ? null : Number(t.units),
    })) as Tx[];
  },
});

export const useProfile = () => useSuspenseQuery(profileQuery).data;
export const useGoals = () => useSuspenseQuery(goalsQuery).data;
export const useTx = () => useSuspenseQuery(txQuery).data;