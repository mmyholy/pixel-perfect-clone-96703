import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Goal } from "@/hooks/use-saveflow";
import { addToGoal } from "@/hooks/use-savings-actions";
import { naira } from "@/lib/saveflow";

export function AddToSavings({
  goals,
  balance,
}: {
  goals: Goal[];
  balance: number;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [goalId, setGoalId] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const eligible = goals.filter(
    (g) => g.status === "active" && g.maturity_date > today
  );

  const selectedId = eligible.some((g) => g.id === goalId)
    ? goalId
    : eligible[0]?.id ?? "";

  const selected = eligible.find((g) => g.id === selectedId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;

    const value = amount.trim();

    if (!/^\d+(\.\d{1,2})?$/.test(value)) {
      return toast.error("Enter an amount with up to two decimal places");
    }

    const n = Number(value);

    if (!Number.isFinite(n) || n <= 0) {
      return toast.error("Enter an amount greater than zero");
    }
    if (n > balance) {
      return toast.error("Insufficient available balance");
    }
    if (!selected) {
      return toast.error("Select an active goal");
    }

    setBusy(true);

    try {
      const result = await addToGoal(selected.id, n);

      toast.success(
        `${naira(result.amount)} added to ${result.goal}`
      );

      setAmount("");
      setOpen(false);
      await qc.invalidateQueries();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not add savings"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <Button
        type="button"
        className="w-full"
        disabled={balance <= 0 || eligible.length === 0 || busy}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Close" : "Add to savings"}
      </Button>

      {eligible.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Create a goal with a future lock date to save from your balance.
        </p>
      )}

      {open && (
        <form onSubmit={submit} className="mt-4 space-y-4 border-t pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="manual-goal">Choose a goal</Label>
            <select
              id="manual-goal"
              className="h-11 w-full rounded-md border bg-background px-3 text-sm"
              value={selectedId}
              disabled={busy}
              onChange={(e) => setGoalId(e.target.value)}
            >
              {eligible.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} · {g.asset}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="manual-amount">Amount in Naira</Label>
            <Input
              id="manual-amount"
              inputMode="decimal"
              placeholder="e.g. 10000"
              value={amount}
              disabled={busy}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Available: {naira(balance)}
            </p>
          </div>

          {selected && (
            <p className="text-xs text-muted-foreground">
              Saves into {selected.asset}, locked until{" "}
              {new Date(
                `${selected.maturity_date}T00:00:00Z`
              ).toLocaleDateString("en-NG", {
                timeZone: "UTC",
                dateStyle: "medium",
              })}
              . Early withdrawal costs 7% and forfeits interest.
              Your automatic savings percentage will not apply again.
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={busy || !selected}
          >
            {busy ? "Saving…" : "Confirm transfer to savings"}
          </Button>
        </form>
      )}
    </div>
  );
}