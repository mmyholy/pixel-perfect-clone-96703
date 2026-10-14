import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — SaveFlow" },
      { name: "description", content: "Sign in or create your SaveFlow account." },
      { property: "og:title", content: "Sign in — SaveFlow" },
      { property: "og:description", content: "Sign in or create your SaveFlow account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [f, setF] = useState({ email: "", password: "", name: "", phone: "" });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => data.user && navigate({ to: "/dashboard" }));
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password });
      setBusy(false);
      if (error) return toast.error(error.message);
      navigate({ to: "/dashboard" });
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: f.email,
        password: f.password,
        options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: f.name, phone: f.phone } },
      });
      setBusy(false);
      if (error) return toast.error(error.message);
      if (data.session) navigate({ to: "/dashboard" });
      else setSent(true);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink-gradient p-10 text-ink-foreground md:flex">
        <Logo inverted />
        <p className="max-w-sm font-display text-3xl font-semibold leading-snug">
          Every inflow, a little locked away. The rest, yours.
        </p>
        <p className="text-xs text-ink-foreground/50">All transactions are simulated in this MVP.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 md:hidden"><Logo /></div>
          {sent ? (
            <div>
              <h1 className="text-2xl font-bold">Check your email</h1>
              <p className="mt-2 text-muted-foreground">We sent a confirmation link to {f.email}. Click it to activate your account.</p>
              <Button variant="link" className="mt-4 px-0" onClick={() => { setSent(false); setMode("in"); }}>Back to sign in</Button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold">{mode === "in" ? "Welcome back" : "Create your account"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "in" ? "Sign in to see your savings." : "Start saving from every payment you receive."}
              </p>
              <form onSubmit={submit} className="mt-6 space-y-4">
                {mode === "up" && (
                  <>
                    <Field label="Full name"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
                    <Field label="Phone"><Input type="tel" placeholder="080..." value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
                  </>
                )}
                <Field label="Email"><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
                <Field label="Password"><Input type="password" required minLength={6} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
                <Button className="h-11 w-full" disabled={busy}>{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}</Button>
              </form>
              <p className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "in" ? "New to SaveFlow?" : "Already have an account?"}{" "}
                <button className="font-semibold text-primary" onClick={() => setMode(mode === "in" ? "up" : "in")}>
                  {mode === "in" ? "Create account" : "Sign in"}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
