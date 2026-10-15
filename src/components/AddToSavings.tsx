import { useRef, useState, type FormEvent } from "react";
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
  const submitting = useRef(false);

  const [open, setOpen] = useState(false);
  const [goalId, setGoalId] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const eligible = goals.filter(
    (goal) =>
      goal.status === "active" &&
      goal.maturity_date > today
  );

  const selectedId = eligible.some((goal) => goal.id === goalId)
    ? goalId
    : eligible[0]?.id ?? "";

  const selected = eligible.find(
    (goal) => goal.id === selectedId
  );

  const hasBalance = Number.isFinite(balance) && balance > 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting.current) return;

    const value = amount.trim();

    if (!/^\d+(\.\d{1,2})?$/.test(value)) {
      toast.error("Enter an amount with up to two decimal places");
      return;
    }

    const amountToSave = Number(value);

    if (!Number.isFinite(amountToSave) || amountToSave <= 0) {
      toast.error("Enter an amount greater than zero");
      return;
    }

    if (amountToSave > 1_000_000_000) {
      toast.error("The maximum amount per transfer is ₦1,000,000,000");
      return;
    }

    if (!hasBalance || amountToSave > balance) {
      toast.error("Insufficient available balance");
      return;
    }

    if (!selected) {
      toast.error("Select an active goal with a future maturity date");
      return;
    }

    if (
      selected.maturity_date <=
      new Date().toISOString().slice(0, 10)
    ) {
      toast.error("This goal has matured. Select another goal");
      return;
    }

    submitting.current = true;
    setBusy(true);

    try {
      const result = await addToGoal(selected.id, amountToSave);

      toast.success(
        `${naira(result.amount)} added to ${result.goal}`
      );

      setAmount("");
      setOpen(false);

      await qc.invalidateQueries();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not add savings"
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <div>
      <Button
        type="button"
        className="w-full"
        disabled={
          busy ||
          (!open && (!hasBalance || eligible.length === 0))
        }
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Close" : "Add to savings"}
      </Button>

      {eligible.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Create a goal with a future maturity date to save from
          your available balance.
        </p>
      )}

      {eligible.length > 0 && !hasBalance && (
        <p className="mt-2 text-xs text-muted-foreground">
          You need an available balance to add to savings.
        </p>
      )}

      {open && (
        <form
          onSubmit={submit}
          className="mt-4 space-y-4 border-t pt-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="manual-goal">
              Choose a goal
            </Label>

            <select
              id="manual-goal"
              className="h-11 w-full rounded-md border bg-background px-3 text-sm"
              value={selectedId}
              disabled={busy || eligible.length === 0}
              onChange={(event) => setGoalId(event.target.value)}
              required
            >
              {eligible.length === 0 && (
                <option value="">No eligible goals</option>
              )}

              {eligible.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.name} · {goal.asset}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="manual-amount">
              Amount in Naira
            </Label>

            <Input
              id="manual-amount"
              inputMode="decimal"
              placeholder="e.g. 10000"
              value={amount}
              disabled={busy}
              onChange={(event) => {
                const value = event.target.value;

                if (/^\d*\.?\d{0,2}$/.test(value)) {
                  setAmount(value);
                }
              }}
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
              . Savings cannot be withdrawn before this date.
              The full amount entered moves from your available
              balance into this goal.
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={busy || !selected || !hasBalance}
          >
            {busy ? "Saving…" : "Confirm transfer to savings"}
          </Button>
        </form>
      )}
    </div>
  );
}