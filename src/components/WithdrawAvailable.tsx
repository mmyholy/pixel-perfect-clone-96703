import { useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { naira } from "@/lib/saveflow";

// Local demo options, not a complete live banking directory.
const BANKS = [
  "Access Bank",
  "ALAT by Wema",
  "Carbon",
  "Ecobank Nigeria",
  "FairMoney Microfinance Bank",
  "Fidelity Bank",
  "First Bank of Nigeria",
  "First City Monument Bank (FCMB)",
  "Globus Bank",
  "Guaranty Trust Bank (GTBank)",
  "Jaiz Bank",
  "Keystone Bank",
  "Kuda Microfinance Bank",
  "LOTUS Bank",
  "Moniepoint Microfinance Bank",
  "OPay",
  "PalmPay",
  "Parallex Bank",
  "Polaris Bank",
  "PremiumTrust Bank",
  "Providus Bank",
  "Rubies Microfinance Bank",
  "Sparkle Microfinance Bank",
  "Stanbic IBTC Bank",
  "Standard Chartered Bank",
  "Sterling Bank",
  "SunTrust Bank",
  "TAJBank",
  "Titan Trust Bank",
  "Union Bank",
  "United Bank for Africa (UBA)",
  "Unity Bank",
  "VFD Microfinance Bank",
  "Wema Bank",
  "Zenith Bank",
].sort((a, b) => a.localeCompare(b));

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

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

export function WithdrawAvailable({
  balance,
}: {
  balance: number;
}) {
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState("");
  const [bankSearch, setBankSearch] = useState("");
  const [choosingBank, setChoosingBank] = useState(false);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [busy, setBusy] = useState(false);

  const submitting = useRef(false);
  const bankInput = useRef<HTMLInputElement>(null);
  const request = useRef<{
    signature: string;
    id: string;
  } | null>(null);

  const hasBalance = Number.isFinite(balance) && balance > 0;
  const search = normalize(bankSearch);

  const matches = BANKS.filter((name) =>
    normalize(name).includes(search)
  );

  function selectBank(name: string) {
    setBank(name);
    setBankSearch(name);
    setChoosingBank(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting.current) return;

    const value = amount.trim();
    const amountToWithdraw = Number(value);

    if (
      !/^\d+(\.\d{1,2})?$/.test(value) ||
      !Number.isFinite(amountToWithdraw) ||
      amountToWithdraw <= 0 ||
      amountToWithdraw > 1_000_000_000
    ) {
      toast.error(
        "Enter a valid amount with up to two decimal places"
      );
      return;
    }

    if (!hasBalance || amountToWithdraw > balance) {
      toast.error("Insufficient available balance");
      return;
    }

    if (!bank || !BANKS.includes(bank)) {
      toast.error("Select a bank from the options");
      setChoosingBank(true);
      bankInput.current?.focus();
      return;
    }

    if (
      accountName.trim().length < 2 ||
      !/^\d{10}$/.test(accountNumber)
    ) {
      toast.error(
        "Enter an account name and a 10-digit account number"
      );
      return;
    }

    const confirmed = window.confirm(
      [
        "Confirm simulated bank withdrawal",
        "",
        `Amount: ${naira(amountToWithdraw)}`,
        `Bank: ${bank}`,
        `Account name: ${accountName.trim()}`,
        `Account number: ${accountNumber}`,
        "",
        "This deducts your demo available balance.",
        "No real money will be sent to a bank.",
      ].join("\n")
    );

    if (!confirmed) return;

    const signature = JSON.stringify([
      amountToWithdraw,
      bank,
      accountNumber,
      accountName.trim(),
    ]);

    if (request.current?.signature !== signature) {
      request.current = {
        signature,
        id: crypto.randomUUID(),
      };
    }

    const requestId = request.current.id;

    submitting.current = true;
    setBusy(true);

    try {
      const rpc =
        supabase.rpc.bind(supabase) as unknown as WithdrawalRpc;

      const { data, error } = await rpc("withdraw_available", {
        _request_id: requestId,
        _amount: amountToWithdraw,
        _bank_name: bank,
        _account_number: accountNumber,
        _account_name: accountName.trim(),
      });

      if (error) throw new Error(error.message);

      if (!data) {
        throw new Error("No withdrawal response received");
      }

      request.current = null;
      setAmount("");
      setBank("");
      setBankSearch("");
      setChoosingBank(false);
      setAccountName("");
      setAccountNumber("");
      setOpen(false);

      toast.success(
        `${naira(data.amount)} demo withdrawal recorded. No bank transfer sent.`
      );

      await qc.invalidateQueries();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Withdrawal failed"
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
        disabled={busy || (!open && !hasBalance)}
        onClick={() => {
          setOpen((value) => !value);
          setChoosingBank(false);
        }}
      >
        {open ? "Close withdrawal" : "Withdraw available balance"}
      </Button>

      {open && (
        <form
          onSubmit={submit}
          className="mt-4 space-y-4 border-t pt-4"
        >
          <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
            Demo withdrawal only. Bank details are not verified
            and no real transfer is sent. Use test details.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="withdraw-amount">
              Amount in Naira
            </Label>

            <Input
              id="withdraw-amount"
              inputMode="decimal"
              placeholder="e.g. 1000"
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

          <div className="space-y-1.5">
            <Label htmlFor="withdraw-bank">
              Bank or payment provider
            </Label>

            <Input
              ref={bankInput}
              id="withdraw-bank"
              type="text"
              placeholder="Search e.g. Kuda, OPay or GTBank"
              autoComplete="off"
              value={bankSearch}
              maxLength={100}
              disabled={busy}
              aria-describedby="withdraw-bank-help"
              aria-controls={
                choosingBank ? "withdraw-bank-options" : undefined
              }
              onFocus={() => setChoosingBank(true)}
              onChange={(event) => {
                setBankSearch(event.target.value);
                setBank("");
                setChoosingBank(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setChoosingBank(false);
                }

                if (event.key === "Enter" && choosingBank) {
                  event.preventDefault();

                  if (matches.length === 1) {
                   const firstMatch = matches[0];

if (matches.length === 1 && firstMatch !== undefined) {
  selectBank(firstMatch);
}
                  }
                }
              }}
              required
            />

            {choosingBank && (
              <div
                id="withdraw-bank-options"
                className="rounded-xl border bg-card shadow-sm"
              >
                <ul
                  aria-label="Matching banks"
                  className="max-h-52 overflow-y-auto p-1"
                >
                  {matches.map((name) => (
                    <li key={name}>
                      <button
                        type="button"
                        disabled={busy}
                        className="w-full rounded-lg px-3 py-3 text-left text-sm hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                        onClick={() => selectBank(name)}
                      >
                        {name}
                      </button>
                    </li>
                  ))}

                  {matches.length === 0 && (
                    <li className="px-3 py-4 text-sm text-muted-foreground">
                      No matching bank in this demo list.
                    </li>
                  )}
                </ul>

                <button
                  type="button"
                  className="w-full border-t px-3 py-2 text-sm text-muted-foreground"
                  onClick={() => setChoosingBank(false)}
                >
                  Close options
                </button>
              </div>
            )}

            <p
              id="withdraw-bank-help"
              className="text-xs text-muted-foreground"
              aria-live="polite"
            >
              {bank
                ? `Selected: ${bank}`
                : "Type a bank name, then select a matching option."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="withdraw-account">
              Account number
            </Label>

            <Input
              id="withdraw-account"
              inputMode="numeric"
              placeholder="10-digit account number"
              value={accountNumber}
              maxLength={10}
              disabled={busy}
              onChange={(event) =>
                setAccountNumber(
                  event.target.value.replace(/\D/g, "").slice(0, 10)
                )
              }
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="withdraw-name">
              Account name
            </Label>

            <Input
              id="withdraw-name"
              placeholder="Enter test account name"
              value={accountName}
              maxLength={100}
              disabled={busy}
              onChange={(event) =>
                setAccountName(event.target.value)
              }
              required
            />

            <p className="text-xs text-muted-foreground">
              Enter the name manually for this demo.
            </p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={busy || !hasBalance}
          >
            {busy ? "Processing…" : "Review demo withdrawal"}
          </Button>
        </form>
      )}
    </div>
  );
}