import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Lock, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AssetDot } from "@/components/Logo";
import { goalsQuery, useGoals, type Goal } from "@/hooks/use-saveflow";
import {
  ASSETS,
  accruedInterest,
  earlyPenalty,
  interestRateFor,
  naira,
  units,
  type Asset,
} from "@/lib/saveflow";

const LOCK_MONTHS = [1, 3, 6, 12] as const;

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({ meta: [{ title: "Goals — SaveFlow" }, { name: "description", content: "Create and manage locked savings goals." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(goalsQuery),
  component: Goals,
});

function addMonthsYmd(months: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function Goals() {
  const qc = useQueryClient();
  const all = useGoals();
  const active = all.filter((g) => g.status === "active");
  const used = active.reduce((s, g) => s + g.percentage, 0);
  const remaining = Math.max(0, 100 - used);

  const [name, setName] = useState("");
  const [percentage, setPercentage] = useState("");
  const [asset, setAsset] = useState<Asset>("NGN");
  const [lock, setLock] = useState<(typeof LOCK_MONTHS)[number]>(3);
  const [busy, setBusy] = useState(false);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);

  const rate = interestRateFor(asset, lock);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const pct = Number(percentage);
    if (!name.trim()) return toast.error("Give the goal a name");
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return toast.error("Enter a percentage between 0 and 100");
    if (pct > remaining) return toast.error(`Only ${remaining}% of each inflow is still unallocated`);
    setBusy(true);
    const { error } = await supabase.from("goals").insert({
      name: name.trim(),
      percentage: pct,
      asset,
      maturity_date: addMonthsYmd(lock),
      interest_rate: rate,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Goal created");
    setName("");
    setPercentage("");
    qc.invalidateQueries({ queryKey: ["goals"] });
  }

  async function withdraw(g: Goal) {
    setWithdrawing(g.id);
    const { error } = await supabase.rpc("withdraw_goal", { _goal_id: g.id });
    setWithdrawing(null);
    if (error) return toast.error(error.message);
    toast.success("Withdrawal complete");
    qc.invalidateQueries();
  }

  async function removeEmpty(g: Goal) {
    const { error } = await supabase.from("goals").delete().eq("id", g.id);
    if (error) return toast.error(error.message);
    toast.success("Goal removed");
    qc.invalidateQueries({ queryKey: ["goals"] });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Goals</h1>
          <p className="mt-1 text-sm text-muted-foreground">Lock a slice of every inflow into Naira, Dollar, Bitcoin or USDT.</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Allocated per inflow</p>
          <p className="font-display text-2xl font-bold">{used}%</p>
          <Progress value={used} className="mt-1 w-40" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="space-y-4">
          {active.length === 0 ? (
            <div className="rounded-3xl border bg-card p-10 text-center shadow-soft">
              <p className="text-sm text-muted-foreground">No active goals yet. Create one to start auto-saving.</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {active.map((g) => {
                const mature = new Date(g.maturity_date) <= new Date();
                const interest = accruedInterest(g.principal_ngn, g.interest_rate, new Date(g.created_at));
                const pct = g.target_amount ? Math.min(100, (g.principal_ngn / g.target_amount) * 100) : null;
                return (
                  <li key={g.id} className="rounded-3xl border bg-card p-6 shadow-soft">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="flex items-center gap-2 font-semibold">
                          <AssetDot asset={g.asset} />
                          {g.name}
                          <span className="text-sm font-normal text-muted-foreground">· {g.percentage}%</span>
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Lock className="size-3" />
                          {mature ? "Matured" : `Locks until ${new Date(g.maturity_date).toLocaleDateString("en-NG", { dateStyle: "medium" })}`}
                          <span>· {g.interest_rate}% / yr</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-xl font-bold tabular">{units(g.units, g.asset)}</p>
                        {g.asset !== "NGN" && <p className="text-xs text-muted-foreground tabular">≈ {naira(g.principal_ngn)}</p>}
                      </div>
                    </div>
                    {pct != null && <Progress value={pct} className="mt-3 h-1.5" />}
                    <p className="mt-3 text-sm text-accent tabular">+{naira(interest)} interest (simulated)</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {g.principal_ngn > 0 ? (
                        <Button
                          variant={mature ? "default" : "outline"}
                          size="sm"
                          disabled={withdrawing === g.id}
                          onClick={() => withdraw(g)}
                        >
                          {withdrawing === g.id
                            ? "Withdrawing…"
                            : mature
                              ? "Withdraw"
                              : `Withdraw early (−${naira(earlyPenalty(g.principal_ngn))} penalty)`}
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => removeEmpty(g)}>
                          Remove
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <form onSubmit={create} className="h-fit space-y-4 rounded-3xl border bg-card p-6 shadow-soft">
          <h2 className="flex items-center gap-2 font-semibold"><Plus className="size-4" /> New goal</h2>
          <div className="space-y-1.5">
            <Label htmlFor="goal-name">Name</Label>
            <Input id="goal-name" placeholder="e.g. Rent fund" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-pct">Percentage of each inflow</Label>
            <Input
              id="goal-pct"
              inputMode="decimal"
              placeholder={remaining > 0 ? `Up to ${remaining}` : "0"}
              value={percentage}
              onChange={(e) => setPercentage(e.target.value.replace(/[^\d.]/g, ""))}
            />
            <p className="text-xs text-muted-foreground">{remaining}% still available</p>
          </div>
          <div className="space-y-1.5">
            <Label>Asset type</Label>
            <Select value={asset} onValueChange={(v) => setAsset(v as Asset)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ASSETS.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Lock period</Label>
            <Select value={String(lock)} onValueChange={(v) => setLock(Number(v) as (typeof LOCK_MONTHS)[number])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LOCK_MONTHS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m} month{m === 1 ? "" : "s"} · {interestRateFor(asset, m)}% / yr
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">This lock earns {rate}% a year. Early withdrawal forfeits interest and costs 7%.</p>
          <Button className="h-11 w-full" disabled={busy || remaining <= 0}>
            {busy ? "Creating…" : remaining <= 0 ? "No percentage left" : "Create goal"}
          </Button>
        </form>
      </div>
    </div>
  );
}
