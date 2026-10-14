import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, Target, ArrowDownToLine, History, User, LogOut } from "lucide-react";
import { Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";

const NAV = [
  { to: "/dashboard", label: "Home", icon: LayoutGrid },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/receive", label: "Receive", icon: ArrowDownToLine },
  { to: "/activity", label: "Activity", icon: History },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppShell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="min-h-screen pb-24 md:pb-0">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/dashboard"><Logo /></Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <button onClick={signOut} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <LogOut className="size-4" /> <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:py-10">
        <Suspense fallback={<div className="py-20 text-center text-muted-foreground">Loading…</div>}>
          <Outlet />
        </Suspense>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t bg-card md:hidden">
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className="flex flex-col items-center gap-1 py-3 text-[11px] text-muted-foreground"
            activeProps={{ className: "text-primary font-semibold" }}
          >
            <n.icon className="size-5" />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
