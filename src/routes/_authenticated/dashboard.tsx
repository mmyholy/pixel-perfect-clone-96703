import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownToLine, Lock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AssetDot } from "@/components/Logo";
import { ActivityRow } from "@/components/ActivityRow";
import { AddToSavings } from "@/components/AddToSavings";
import { WithdrawAvailable } from "@/components/WithdrawAvailable";
import {
  goalsQuery,
  profileQuery,
  txQuery,
  useGoals,
  useProfile,
  useTx,
} from "@/hooks/use-saveflow";
import { useSavingsPreviews } from "@/hooks/use-savings-actions";
import { ASSETS, naira, units } from "@/lib/saveflow";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — SaveFlow" },
      {
        name: "description",
        content: "Your SaveFlow savings overview.",
      },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(profileQuery),
      context.queryClient.ensureQueryData(goalsQuery),
      context.queryClient.ensureQueryData(txQuery),
    ]),
  component: Dashboard,
});

function Dashboard() {
  const profile = useProfile();
  const goals = useGoals().filter((g) => g.status === "active");
  const tx = useTx();
  const previews = useSavingsPreviews(goals);

  const balance = Number(profile.available_balance);
  const total = goals.reduce((sum, g) => sum + g.principal_ngn, 0);
  const pctUsed = goals.reduce((sum, g) => sum + g.percentage, 0);

  const interest = Object.values(previews.data ?? {}).reduce(
    (sum, preview) =>
      sum + preview.interest + preview.forfeited_interest,
    0
  );

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">
          Hi {profile.full_name.trim().split(" ")[0] || "there"} 👋
        </p>
        <h1 className="text-2xl font-bold md:text-3xl">
          Your savings
        </h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl bg-ink-gradient p-6 text-ink-foreground md:col-span-2">
          <div className="flex items-center gap-2 text-sm text-ink-foreground/70">
            <Lock className="size-4" />
            Total locked savings
          </div>

          <p className="mt-2 font-display text-4xl font-bold tabular md:text-5xl">
            {naira(total)}
          </p>

          <p className="mt-2 text-sm text-accent tabular">
            {previews.isError
              ? "Interest temporarily unavailable"
              : previews.isPending
                ? "Loading interest…"
                : `+${naira(interest)} accrued interest (simulated)`}
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild variant="accent">
              <Link to="/receive">
                <ArrowDownToLine />
                Simulate inflow
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="border-ink-foreground/30 bg-transparent text-ink-foreground hover:bg-ink-foreground/10 hover:text-ink-foreground"
            >
              <Link to="/goals">
                <Plus />
                New goal
              </Link>
            </Button>
          </div>
        </div>

        <div className="rounded-3xl border bg-card p-6 shadow-soft">
          <p className="text-sm text-muted-foreground">
            Available to spend
          </p>

          <p className="mt-2 font-display text-3xl font-bold tabular">
            {naira(balance)}
          </p>

          <div className="mt-4 space-y-3">
            <AddToSavings goals={goals} balance={balance} />

            <WithdrawAvailable balance={balance} />
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            Auto-saving per inflow
          </p>

          <p className="font-display text-2xl font-bold">
            {pctUsed}%
          </p>

          <Progress value={pctUsed} className="mt-2" />
        </div>
      </div>

      <section className="rounded-3xl border bg-card p-6 shadow-soft">
        <h2 className="mb-4 font-semibold">Breakdown by asset</h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ASSETS.map((asset) => {
            const assetGoals = goals.filter(
              (g) => g.asset === asset.id
            );
            const ngn = assetGoals.reduce(
              (sum, g) => sum + g.principal_ngn,
              0
            );
            const assetUnits = assetGoals.reduce(
              (sum, g) => sum + g.units,
              0
            );

            return (
              <div
                key={asset.id}
                className="rounded-2xl bg-muted p-4"
              >
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AssetDot asset={asset.id} />
                  {asset.label}
                </div>

                <p className="mt-2 font-display text-xl font-bold tabular">
                  {units(assetUnits, asset.id)}
                </p>

                <p className="text-xs text-muted-foreground tabular">
                  ≈ {naira(ngn)}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border bg-card p-6 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Goals</h2>
            <Link to="/goals" className="text-sm text-primary">
              Manage
            </Link>
          </div>

          {goals.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No goals yet.{" "}
              <Link to="/goals" className="text-primary">
                Create one
              </Link>{" "}
              to start saving.
            </p>
          ) : (
            <ul className="space-y-4">
              {goals.map((goal) => {
                const pct =
                  goal.target_amount && goal.target_amount > 0
                    ? Math.min(
                        100,
                        (goal.principal_ngn / goal.target_amount) * 100
                      )
                    : null;

                return (
                  <li key={goal.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 font-medium">
                        <AssetDot asset={goal.asset} />
                        {goal.name}
                        <span className="text-muted-foreground">
                          · {goal.percentage}%
                        </span>
                      </span>

                      <span className="tabular">
                        {naira(goal.principal_ngn)}
                        {goal.target_amount ? (
                          <span className="text-muted-foreground">
                            {" "}
                            / {naira(goal.target_amount)}
                          </span>
                        ) : null}
                      </span>
                    </div>

                    {pct != null && (
                      <Progress value={pct} className="mt-2 h-1.5" />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-3xl border bg-card p-6 shadow-soft">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Recent activity</h2>
            <Link to="/activity" className="text-sm text-primary">
              See all
            </Link>
          </div>

          {tx.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing yet.
            </p>
          ) : (
            <ul className="divide-y">
              {tx.slice(0, 6).map((transaction) => (
                <ActivityRow
                  key={transaction.id}
                  t={transaction}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}