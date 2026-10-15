import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Goal } from "@/hooks/use-saveflow";

export type WithdrawalPreview = {
  goal_id: string;
  goal: string;
  principal: number;
  early: boolean;
  penalty: number;
  interest: number;
  forfeited_interest: number;
  payout: number;
};

type RpcArguments = {
  add_to_goal: { _goal_id: string; _amount: number };
  preview_goal_withdrawal: { _goal_id: string };
  withdraw_goal: { _goal_id: string };
};

type RpcResults = {
  add_to_goal: {
    amount: number;
    goal: string;
    asset: string;
    units: number;
    available_balance: number;
  };
  preview_goal_withdrawal: WithdrawalPreview;
  withdraw_goal: WithdrawalPreview;
};

type SavingsRpc = <N extends keyof RpcArguments>(
  name: N,
  args: RpcArguments[N]
) => PromiseLike<{
  data: RpcResults[N] | null;
  error: { message: string } | null;
}>;

async function callSavings<N extends keyof RpcArguments>(
  name: N,
  args: RpcArguments[N]
): Promise<RpcResults[N]> {
  const rpc = supabase.rpc.bind(supabase) as unknown as SavingsRpc;
  const { data, error } = await rpc(name, args);

  if (error) throw new Error(error.message);
  if (data == null) throw new Error("No response received");

  return data;
}

export const addToGoal = (goalId: string, amount: number) =>
  callSavings("add_to_goal", {
    _goal_id: goalId,
    _amount: amount,
  });

export const previewWithdrawal = (goalId: string) =>
  callSavings("preview_goal_withdrawal", {
    _goal_id: goalId,
  });

export const withdrawGoal = (goalId: string) =>
  callSavings("withdraw_goal", {
    _goal_id: goalId,
  });

export function useSavingsPreviews(goals: Goal[]) {
  const ids = goals.map((g) => g.id).sort();

  return useQuery({
    queryKey: ["savings-previews", ids],
    queryFn: async () => {
      const entries = await Promise.all(
        ids.map(
          async (id) => [id, await previewWithdrawal(id)] as const
        )
      );

      return Object.fromEntries(entries) as Record<
        string,
        WithdrawalPreview
      >;
    },
    staleTime: 0,
    refetchInterval: 60_000,
  });
}