import { useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { naira } from "@/lib/saveflow";

type WithdrawalArgs = {
  _request_id: string;
  _amount: number;
  _bank_name: string;
  _account_number: string;
  _account_name: string;
};

type WithdrawalResult = {
  reference: string;
  amount: number;
  available_balance: number;
  simulated: boolean;
};

type WithdrawalRpc = (
  name: "withdraw_available",
  args: WithdrawalArgs
) => PromiseLike<{
  data: WithdrawalResult | null;
  error: { message: string } | null;
}>;

export function WithdrawAvailable({ balance }: { balance: number }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [busy, setBusy] = useState(false);

  const submitting = useRef(false);
  const request = useRef<{
    signature: string;
    id: string;
  } | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return;

    const value = amount.trim();
    const n = Number(value);

    if (
      !/^\d+(\.\d{1,2})?$/.test(value) ||
      !Number.isFinite(n) ||
      n <= 0 ||
      n > 1_000_000_000
    ) {
      toast.error("Enter a valid amount with up to two decimal places");
      return;
    }

    if (n > balance) {
      toast.error("Insufficient available balance");
      return;
    }

    if (
      bank.trim().length < 2 ||
      accountName.trim().length < 2 ||
      !/^\d{10}$/.test(accountNumber)
    ) {
      toast.error("Enter a bank, account name and 10-digit account number");
      return;
    }

    const confirmed = window.confirm(
      [
        "Confirm simulated bank withdrawal",
        "",
        `Amount: ${naira(n)}`,
        `Bank: ${bank.trim()}`,
        `Account name: ${accountName.trim()}`,
        `Account number: ${accountNumber}`,
        "",
        "This deducts your demo available balance.",
        "No real money will be sent to a bank.",
      ].join("\n")
    );

    if (!confirmed) return;

    const signature = JSON.stringify([
      n,
      bank.trim(),
      accountNumber,
      accountName.trim(),
    ]);

    if (request.current?.signature !== signature) {
      request.current = {
        signature,
        id: crypto.randomUUID(),
      };
    }

    submitting.current = true;
    setBusy(true);

    try {
      const rpc =
        supabase.rpc.bind(supabase) as unknown as WithdrawalRpc;

      const { data, error } = await rpc("withdraw_available", {
        _request_id: request.current.id,
        _amount: n,
        _bank_name: bank.trim(),
        _account_number: accountNumber,
        _account_name: accountName.trim(),
      });

      if (error) throw new Error(error.message);
      if (!data) throw new Error("No withdrawal response received");

      request.current = null;
      setAmount("");
      setBank("");
      setAccountName("");
      setAccountNumber("");
      setOpen(false);

      toast.success(
        `${naira(data.amount)} demo withdrawal recorded. No bank transfer sent.`
      );

      await qc.invalidateQueries();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Withdrawal failed"
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={busy || (!open && balance <= 0)}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Close withdrawal" : "Withdraw available balance"}
      </Button>

      {open && (
        <form
          onSubmit={submit}
          className="mt-4 space-y-4 border-t pt-4"
        >
          <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
            Demo withdrawal only. Bank details are not verified and no
            real transfer is sent. Use test details.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="withdraw-amount">Amount in Naira</Label>
            <Input
              id="withdraw-amount"
              inputMode="decimal"
              placeholder="e.g. 1000"
              value={amount}
              disabled={busy}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Available: {naira(balance)}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="withdraw-bank">Bank name</Label>
            <Input
              id="withdraw-bank"
              placeholder="Destination bank"
              value={bank}
              maxLength={100}
              disabled={busy}
              onChange={(e) => setBank(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="withdraw-account">Account number</Label>
            <Input
              id="withdraw-account"
              inputMode="numeric"
              placeholder="10-digit account number"
              value={accountNumber}
              maxLength={10}
              disabled={busy}
              onChange={(e) =>
                setAccountNumber(
                  e.target.value.replace(/\D/g, "").slice(0, 10)
                )
              }
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="withdraw-name">Account name</Label>
            <Input
              id="withdraw-name"
              placeholder="Test account name"
              value={accountName}
              maxLength={100}
              disabled={busy}
              onChange={(e) => setAccountName(e.target.value)}
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={busy || balance <= 0}
          >
            {busy ? "Processing…" : "Review demo withdrawal"}
          </Button>
        </form>
      )}
    </div>
  );
}