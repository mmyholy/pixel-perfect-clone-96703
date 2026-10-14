import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock, Percent, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SaveFlow — Save a slice of every inflow" },
      { name: "description", content: "Automatic, locked savings in Naira, Dollar, Bitcoin or USDT for freelancers and business owners in Nigeria." },
      { property: "og:title", content: "SaveFlow — Save a slice of every inflow" },
      { property: "og:description", content: "Automatic, locked savings in ₦, $, BTC or USDT for people with irregular income." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-ink-gradient text-ink-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <Logo inverted />
        <Button asChild variant="accent" size="sm"><Link to="/auth">Sign in</Link></Button>
      </header>
      <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-10 md:grid-cols-2 md:pt-20">
        <div>
          <p className="mb-4 inline-block rounded-full border border-ink-foreground/20 px-3 py-1 text-xs uppercase tracking-widest text-ink-foreground/70">
            For freelancers & business owners
          </p>
          <h1 className="text-4xl font-bold leading-tight md:text-6xl">
            Money comes in at random.<br /><span className="text-accent">Savings shouldn't.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg text-ink-foreground/75">
            Pick a percentage and an asset. Every time you get paid, SaveFlow locks your slice away in ₦, $, BTC or USDT — the rest is yours to spend.
          </p>
          <div className="mt-8 flex gap-3">
            <Button asChild variant="accent" size="lg"><Link to="/auth">Start saving</Link></Button>
          </div>
        </div>
        <div className="rounded-3xl border border-ink-foreground/15 bg-ink-foreground/5 p-6 backdrop-blur">
          <p className="text-sm text-ink-foreground/60">Incoming payment</p>
          <p className="font-display text-4xl font-bold tabular">₦100,000</p>
          <div className="mt-6 space-y-3">
            {[
              ["Rent fund · Naira", "30%", "₦30,000"],
              ["Long-term · Bitcoin", "10%", "₦10,000 → 0.00010526 BTC"],
            ].map(([n, p, v]) => (
              <div key={n} className="flex items-center justify-between rounded-xl bg-ink-foreground/10 px-4 py-3 text-sm">
                <span>{n} <span className="text-accent">{p}</span></span>
                <span className="tabular">{v}</span>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground">
              <span>Yours to spend</span><span className="tabular">₦60,000</span>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-5 pb-20 md:grid-cols-3">
        {[
          [Percent, "Percentage-based", "Save a fixed slice of every inflow, no matter how big or small."],
          [Coins, "Four assets", "Naira, US Dollar, Bitcoin or USDT — per goal."],
          [Lock, "Locked by default", "Longer locks earn more. Early exits cost a 7% penalty."],
        ].map(([Icon, t, d]) => {
          const I = Icon as typeof Lock;
          return (
            <div key={t as string} className="rounded-2xl border border-ink-foreground/15 p-6">
              <I className="mb-4 size-6 text-accent" />
              <h3 className="font-semibold">{t as string}</h3>
              <p className="mt-1 text-sm text-ink-foreground/70">{d as string}</p>
            </div>
          );
        })}
      </section>
      <p className="pb-8 text-center text-xs text-ink-foreground/50">MVP demo — all money movement is simulated.</p>
    </div>
  );
}
