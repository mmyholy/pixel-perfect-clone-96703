import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Lock, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AssetDot } from "@/components/Logo";
import {
  goalsQuery,
  useGoals,
  type Goal,
} from "@/hooks/use-saveflow";
import {
  previewWithdrawal,
  withdrawGoal,
  useSavingsPreviews,
} from "@/hooks/use-savings-actions";
import {
  ASSETS,
  earlyPenalty,
  interestRateFor,
  naira,
  units,
  type Asset,
} from "@/lib/saveflow";

const LOCK_MONTHS = [1, 3, 6, 12] as const;

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({
    meta: [
      { title: "Goals — SaveFlow" },
      {
        name: "description",
        content: "Create and manage locked savings goals.",
      },
    ],
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(goalsQuery),
  component: Goals,
});

function addMonthsYmd(months: number) {
  const d = new Date();
  const originalDay = d.getUTCDate();

  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);

  const lastDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)
  ).getUTCDate();

  d.setUTCDate(Math.min(originalDay, lastDay));
  return d.toISOString().slice(0, 10);
}

function Goals() {
  const qc = useQueryClient();
  const all = useGoals();
  const active = all.filter((g) => g.status === "active");
  const previews = useSavingsPreviews(active);
  const used = active.reduce((sum, g) => sum + g.percentage, 0);
  const remaining = Math.max(0, 100 - used);

  const [name, setName] = useState("");
  const [percentage, setPercentage] = useState("");
  const [asset, setAsset] = useState<Asset>("NGN");
  const [lock, setLock] =
    useState<(typeof LOCK_MONTHS)[number]>(3);
  const [busy, setBusy] = useState(false);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const rate = interestRateFor(asset, lock);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;

    const pct = Number(percentage);

    if (!name.trim()) {
      toast.error("Give the goal a name");
      return;
    }

    if (
      !percentage.trim() ||
      !Number.isFinite(pct) ||
      pct <= 0 ||
      pct > 100
    ) {
      toast.error("Enter a percentage greater than 0 and up to 100");
      return;
    }

    if (pct > remaining) {
      toast.error(
        `Only ${remaining}% of each inflow is still unallocated`
      );
      return;
    }

    setBusy(true);

    try {
      const { error } = await supabase.from("goals").insert({
        name: name.trim(),
        percentage: pct,
        asset,
        maturity_date: addMonthsYmd(lock),
        interest_rate: rate,
      });

      if (error) throw error;

      toast.success("Goal created");
      setName("");
      setPercentage("");

      await qc.invalidateQueries({ queryKey: ["goals"] });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : (error as { message?: string })?.message ??
              "Could not create goal"
      );
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(g: Goal) {
    if (withdrawing) return;

    setWithdrawing(g.id);

    try {
      const preview = await previewWithdrawal(g.id);

      const confirmed = window.confirm(
        [
          `Withdraw all savings from "${preview.goal}"?`,
          "",
          `Principal: ${naira(preview.principal)}`,
          `Early withdrawal penalty: ${naira(preview.penalty)}`,
          `Interest payable: ${naira(preview.interest)}`,
          `Interest forfeited: ${naira(preview.forfeited_interest)}`,
          "",
          `Return to available balance: ${naira(preview.payout)}`,
          "",
          "This closes the goal and stops its automatic allocation.",
        ].join("\n")
      );

      if (!confirmed) return;

      const result = await withdrawGoal(g.id);

      toast.success(
        `${naira(result.payout)} returned to available balance`
      );

      await qc.invalidateQueries();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Withdrawal failed"
      );
    } finally {
      setWithdrawing(null);
    }
  }

  async function removeEmpty(g: Goal) {
    if (removing) return;

    setRemoving(g.id);

    try {
      const { data, error } = await supabase
        .from("goals")
        .delete()
        .eq("id", g.id)
        .select("id");

      if (error) throw error;

      if (!data?.length) {
        throw new Error(
          "Goal could not be removed. Refresh and check its balance."
        );
      }

      toast.success("Goal removed");
      await qc.invalidateQueries({ queryKey: ["goals"] });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : (error as { message?: string })?.message ??
              "Could not remove goal"
      );
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Goals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lock a slice of every inflow into Naira, Dollar,
            Bitcoin or USDT.
          </p>
        </div>

        <div className="text-right">
          <p className="text-sm text-muted-foreground">
            Allocated per inflow
          </p>
          <p className="font-display text-2xl font-bold">{used}%</p>
          <Progress value={used} className="mt-1 w-40" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="space-y-4">
          {active.length === 0 ? (
            <div className="rounded-3xl border bg-card p-10 text-center shadow-soft">
              <p className="text-sm text-muted-foreground">
                No active goals yet. Create one to start auto-saving.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {active.map((g) => {
                const mature =
                  g.maturity_date <=
                  new Date().toISOString().slice(0, 10);

                const preview = previews.data?.[g.id];
                const interest = preview
                  ? preview.interest + preview.forfeited_interest
                  : null;

                const pct =
                  g.target_amount && g.target_amount > 0
                    ? Math.min(
                        100,
                        (g.principal_ngn / g.target_amount) * 100
                      )
                    : null;

                const maturityLabel = new Date(
                  `${g.maturity_date}T00:00:00Z`
                ).toLocaleDateString("en-NG", {
                  dateStyle: "medium",
                  timeZone: "UTC",
                });

                return (
                  <li
                    key={g.id}
                    className="rounded-3xl border bg-card p-6 shadow-soft"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="flex items-center gap-2 font-semibold">
                          <AssetDot asset={g.asset} />
                          {g.name}
                          <span className="text-sm font-normal text-muted-foreground">
                            · {g.percentage}%
                          </span>
                        </p>

                        <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                          <Lock className="size-3" />
                          {mature
                            ? "Matured"
                            : `Locks until ${maturityLabel}`}
                          <span>· {g.interest_rate}% / yr</span>
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-display text-xl font-bold tabular">
                          {units(g.units, g.asset)}
                        </p>
                        {g.asset !== "NGN" && (
                          <p className="text-xs text-muted-foreground tabular">
                            ≈ {naira(g.principal_ngn)}
                          </p>
                        )}
                      </div>
                    </div>

                    {pct != null && (
                      <Progress value={pct} className="mt-3 h-1.5" />
                    )}

                    <p className="mt-3 text-sm text-accent tabular">
                      {previews.isError
                        ? "Interest temporarily unavailable"
                        : interest == null
                          ? "Loading interest…"
                          : `+${naira(interest)} accrued interest (simulated)`}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {g.principal_ngn > 0 ? (
                        <Button
                          type="button"
                          variant={mature ? "default" : "outline"}
                          size="sm"
                          disabled={
                            withdrawing !== null || removing !== null
                          }
                          onClick={() => withdraw(g)}
                        >
                          {withdrawing === g.id
                            ? "Processing…"
                            : mature
                              ? "Withdraw savings"
                              : `Withdraw early (−${naira(
                                  earlyPenalty(g.principal_ngn)
                                )} penalty)`}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={
                            removing !== null || withdrawing !== null
                          }
                          onClick={() => removeEmpty(g)}
                        >
                          {removing === g.id ? "Removing…" : "Remove"}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <form
          onSubmit={create}
          className="h-fit space-y-4 rounded-3xl border bg-card p-6 shadow-soft"
        >
          <h2 className="flex items-center gap-2 font-semibold">
            <Plus className="size-4" /> New goal
          </h2>

          <div className="space-y-1.5">
            <Label htmlFor="goal-name">Name</Label>
            <Input
              id="goal-name"
              placeholder="e.g. Rent fund"
              value={name}
              maxLength={80}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="goal-pct">
              Percentage of each inflow
            </Label>
            <Input
              id="goal-pct"
              inputMode="decimal"
              placeholder={remaining > 0 ? `Up to ${remaining}` : "0"}
              value={percentage}
              disabled={busy}
              onChange={(e) => {
                const value = e.target.value;
                if (/^\d*\.?\d*$/.test(value)) {
                  setPercentage(value);
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              {remaining}% still available
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="goal-asset">Asset type</Label>
            <Select
              value={asset}
              disabled={busy}
              onValueChange={(value) => setAsset(value as Asset)}
            >
              <SelectTrigger id="goal-asset">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSETS.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="goal-lock">Lock period</Label>
            <Select
              value={String(lock)}
              disabled={busy}
              onValueChange={(value) =>
                setLock(Number(value) as (typeof LOCK_MONTHS)[number])
              }
            >
              <SelectTrigger id="goal-lock">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCK_MONTHS.map((months) => (
                  <SelectItem key={months} value={String(months)}>
                    {months} month{months === 1 ? "" : "s"} ·{" "}
                    {interestRateFor(asset, months)}% / yr
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-sm text-muted-foreground">
            This lock earns {rate}% a year. Early withdrawal
            forfeits interest and costs 7%.
          </p>

          <Button
            type="submit"
            className="h-11 w-full"
            disabled={busy || remaining <= 0}
          >
            {busy
              ? "Creating…"
              : remaining <= 0
                ? "No percentage left"
                : "Create goal"}
          </Button>
        </form>
      </div>
    </div>
  );
}