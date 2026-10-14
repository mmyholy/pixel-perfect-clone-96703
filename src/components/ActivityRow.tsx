import { ArrowDownLeft, ArrowUpRight, PiggyBank, AlertTriangle, Sparkles } from "lucide-react";
import type { Tx } from "@/hooks/use-saveflow";
import { naira, units } from "@/lib/saveflow";

const META = {
  inflow: { icon: ArrowDownLeft, label: "Money received", cls: "bg-success/15 text-success", sign: "+" },
  allocation: { icon: PiggyBank, label: "Auto-saved", cls: "bg-primary/10 text-primary", sign: "" },
  withdrawal: { icon: ArrowUpRight, label: "Withdrawal", cls: "bg-secondary text-secondary-foreground", sign: "" },
  penalty: { icon: AlertTriangle, label: "Penalty", cls: "bg-destructive/10 text-destructive", sign: "−" },
  interest: { icon: Sparkles, label: "Interest", cls: "bg-warning/15 text-warning", sign: "+" },
} as const;

export function ActivityRow({ t }: { t: Tx }) {
  const m = META[t.type];
  return (
    <li className="flex items-center gap-3 py-3">
      <span className={`grid size-9 shrink-0 place-items-center rounded-full ${m.cls}`}><m.icon className="size-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{m.label}{t.description ? ` · ${t.description}` : ""}</p>
        <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold tabular">{m.sign}{naira(t.amount_ngn)}</p>
        {t.units != null && t.asset && t.asset !== "NGN" && <p className="text-xs text-muted-foreground tabular">{units(t.units, t.asset)}</p>}
      </div>
    </li>
  );
}
