export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className={`flex items-center gap-2 font-display text-lg font-bold ${inverted ? "text-ink-foreground" : "text-foreground"}`}>
      <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M4 15c3 0 3-6 6-6s3 6 6 6 3-4 4-4" />
        </svg>
      </span>
      SaveFlow
    </span>
  );
}

export function AssetDot({ asset }: { asset: string }) {
  const cls = { NGN: "bg-asset-ngn", USD: "bg-asset-usd", BTC: "bg-asset-btc", USDT: "bg-asset-usdt" }[asset] ?? "bg-muted";
  return <span className={`inline-block size-2.5 shrink-0 rounded-full ${cls}`} />;
}
