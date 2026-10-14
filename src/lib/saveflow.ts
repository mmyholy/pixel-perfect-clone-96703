export type Asset = "NGN" | "USD" | "BTC" | "USDT";

export const ASSETS: { id: Asset; label: string; symbol: string }[] = [
  { id: "NGN", label: "Naira", symbol: "₦" },
  { id: "USD", label: "US Dollar", symbol: "$" },
  { id: "BTC", label: "Bitcoin", symbol: "BTC" },
  { id: "USDT", label: "Tether (USDT)", symbol: "USDT" },
];

/** Simulated NGN value of 1 unit of each asset. Must match public.asset_rate in the database. */
export const RATES: Record<Asset, number> = { NGN: 1, USD: 1550, USDT: 1550, BTC: 95_000_000 };

/** Base yearly interest rate (%) per asset. */
export const BASE_RATE: Record<Asset, number> = { NGN: 12, USD: 4, USDT: 6, BTC: 2 };

export const EARLY_PENALTY = 0.07;

export function lockMonths(from: Date, maturity: Date) {
  return (maturity.getTime() - from.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
}

/** Longer locks earn more: +1.5% for 3+ months, +3% for 6+, +5% for 12+. */
export function interestRateFor(asset: Asset, months: number) {
  const bonus = months >= 12 ? 5 : months >= 6 ? 3 : months >= 3 ? 1.5 : 0;
  return BASE_RATE[asset] + bonus;
}

export function accruedInterest(principal: number, ratePct: number, createdAt: Date, now = new Date()) {
  const days = Math.max(0, (now.getTime() - createdAt.getTime()) / 86400000);
  return Math.round(principal * (ratePct / 100) * (days / 365) * 100) / 100;
}

export function allocate(amount: number, goals: { name: string; percentage: number }[]) {
  const parts = goals.map((g) => ({ ...g, amount: Math.round(amount * g.percentage) / 100 }));
  const allocated = parts.reduce((s, p) => s + p.amount, 0);
  return { parts, allocated, remaining: amount - allocated };
}

export function earlyPenalty(principal: number) {
  return Math.round(principal * EARLY_PENALTY * 100) / 100;
}

export const naira = (n: number) =>
  "₦" + Number(n).toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function units(n: number, asset: Asset) {
  if (asset === "NGN") return naira(n);
  if (asset === "USD") return "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  if (asset === "BTC") return Number(n).toFixed(8) + " BTC";
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 }) + " USDT";
}
