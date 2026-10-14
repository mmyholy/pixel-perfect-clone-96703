import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ActivityRow } from "@/components/ActivityRow";
import { txQuery, useTx } from "@/hooks/use-saveflow";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({ meta: [{ title: "Activity — SaveFlow" }, { name: "description", content: "Your inflows, savings, interest and withdrawals." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(txQuery),
  component: Activity,
});

const FILTERS = ["all", "inflow", "allocation", "interest", "withdrawal", "penalty"] as const;

function Activity() {
  const tx = useTx();
  const [f, setF] = useState<(typeof FILTERS)[number]>("all");
  const list = f === "all" ? tx : tx.filter((t) => t.type === f);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold md:text-3xl">Activity</h1>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((x) => (
          <button key={x} onClick={() => setF(x)} className={`rounded-full px-4 py-1.5 text-sm capitalize ${f === x ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
            {x === "allocation" ? "saved" : x}
          </button>
        ))}
      </div>
      <div className="rounded-3xl border bg-card px-6 shadow-soft">
        {list.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">No activity yet.</p> : <ul className="divide-y">{list.map((t) => <ActivityRow key={t.id} t={t} />)}</ul>}
      </div>
    </div>
  );
}
