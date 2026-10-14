import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AssetDot } from "@/components/Logo";
import { goalsQuery, useGoals } from "@/hooks/use-saveflow";
import { allocate, naira, units, type Asset } from "@/lib/saveflow";

export const Route = createFileRoute("/_authenticated/receive")({
  head: () => ({ meta: [{ title: "Receive money — SaveFlow" }, { name: "description", content: "Simulate an incoming payment." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(goalsQuery),
  component: Receive,
});

type Result = {
  amount: number;
  allocated: number;
  remaining: number;
  allocations: { goal: string; percentage: number; asset: Asset; amount_ngn: number; units: number }[];
};

function Receive() {
  const qc = useQueryClient();
  const goals = useGoals().filter((g) => g.status === "active");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const n = Number(amount.replace(/,/g, "")) || 0;
  const preview = allocate(n, goals);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (n <= 0) return toast.error("Enter an amount");
    setBusy(true);
    const { data, error } = await supabase.rpc("receive_inflow", { _amount: n, _description: desc || "Payment received" });
    setBusy(false);
    if (error) return toast.error(error.message);
    setResult(data as unknown as Result);
    setAmount(""); setDesc("");
    qc.invalidateQueries();
  }

  if (result) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div className="rounded-3xl bg-ink-gradient p-6 text-ink-foreground">
          <p className="text-sm text-ink-foreground/70">You received</p>
          <p className="font-display text-4xl font-bold tabular">{naira(result.amount)}</p>
        </div>
        <div className="rounded-3xl border bg-card p-6 shadow-soft">
          <h2 className="mb-4 font-semibold">Automatically saved</h2>
          {result.allocations.length === 0 ? <p className="text-sm text-muted-foreground">No active goals — nothing was saved.</p> : (
            <ul className="space-y-3">
              {result.allocations.map((a) => (
                <li key={a.goal} className="flex items-center justify-between rounded-xl bg-muted px-4 py-3 text-sm">
                  <span className="flex items-center gap-2"><AssetDot asset={a.asset} />{a.goal} <span className="text-muted-foreground">{a.percentage}%</span></span>
                  <span className="text-right tabular">
                    <span className="block font-semibold">{naira(Number(a.amount_ngn))}</span>
                    {a.asset !== "NGN" && <span className="text-xs text-muted-foreground">→ {units(Number(a.units), a.asset)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex items-center justify-between rounded-xl bg-accent px-4 py-4 font-semibold text-accent-foreground">
            <span>Remaining — yours to spend</span><span className="tabular">{naira(Number(result.remaining))}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setResult(null)}>Receive more</Button>
          <Button asChild variant="outline"><Link to="/dashboard">Go to dashboard</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Receive money</h1>
        <p className="mt-1 text-sm text-muted-foreground">Simulate a client payment or sale landing in your account.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label>Amount (₦)</Label>
            <Input inputMode="decimal" className="h-14 font-display text-2xl" placeholder="100,000" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input placeholder="e.g. Logo design for Ada's Bakery" value={desc} maxLength={120} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <Button className="h-11 w-full" disabled={busy}>{busy ? "Processing…" : "Receive & auto-save"}</Button>
        </form>
      </div>
      <div className="rounded-3xl border bg-card p-6 shadow-soft">
        <h2 className="font-semibold">What will happen</h2>
        {goals.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">You have no goals yet, so all of it stays with you. <Link to="/goals" className="text-primary">Create a goal</Link>.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm">
            {preview.parts.map((p, i) => (
              <li key={i} className="flex justify-between"><span className="flex items-center gap-2"><AssetDot asset={goals[i].asset} />{p.name} ({p.percentage}%)</span><span className="tabular">{naira(p.amount)}</span></li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex justify-between border-t pt-4 font-semibold"><span>Stays with you</span><span className="tabular">{naira(preview.remaining)}</span></div>
      </div>
    </div>
  );
}
