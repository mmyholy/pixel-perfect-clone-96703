import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
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
      {
        name: "description",
        content: "Sign in or create your SaveFlow account.",
      },
      { property: "og:title", content: "Sign in — SaveFlow" },
      {
        property: "og:description",
        content: "Sign in or create your SaveFlow account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function messageFrom(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    return String(error.message);
  }

  return "Something went wrong. Please try again.";
}

function AuthPage() {
  const navigate = useNavigate();
  const submitting = useRef(false);
  const redirected = useRef(false);

  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [resendAfter, setResendAfter] = useState(0);
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
  });

  useEffect(() => {
    let active = true;

    function enterDashboard() {
      if (!active || redirected.current) return;

      redirected.current = true;
      void navigate({ to: "/dashboard", replace: true });
    }

    // Handles a confirmation link that signs the user in.
    const { data } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user.email_confirmed_at) {
          enterDashboard();
        }
      }
    );

    // Handles someone who is already signed in.
    void supabase.auth.getUser().then(({ data, error }) => {
      if (!error && data.user?.email_confirmed_at) {
        enterDashboard();
      }
    });

    const hash = new URLSearchParams(
      window.location.hash.replace(/^#/, "")
    );
    const search = new URLSearchParams(window.location.search);
    const linkError =
      hash.get("error_description") ||
      search.get("error_description");

    if (linkError) {
      toast.error(linkError);
    }

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    if (resendAfter <= 0) return;

    const timer = window.setTimeout(() => {
      setResendAfter((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendAfter]);

  function showConfirmation(email: string) {
    setConfirmationEmail(email);
    setSent(true);
    setForm((current) => ({ ...current, password: "" }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting.current) return;

    const email = form.email.trim();

    if (mode === "up" && !form.name.trim()) {
      toast.error("Enter your full name");
      return;
    }

    submitting.current = true;
    setBusy(true);

    try {
      if (mode === "in") {
        const { data, error } =
          await supabase.auth.signInWithPassword({
            email,
            password: form.password,
          });

        if (error) {
          if (error.code === "email_not_confirmed") {
            showConfirmation(email);
            toast.error("Confirm your email before signing in");
            return;
          }

          throw error;
        }

        if (!data.session || !data.user.email_confirmed_at) {
          showConfirmation(email);
          return;
        }

        await navigate({ to: "/dashboard", replace: true });
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
          data: {
            full_name: form.name.trim(),
            phone: form.phone.trim(),
          },
        },
      });

      if (error) throw error;

      if (data.session) {
        toast.error(
          "Email confirmation is not enabled in Supabase yet. Enable it before inviting testers."
        );
        await supabase.auth.signOut();
      }

      showConfirmation(email);
      setResendAfter(60);
    } catch (error) {
      toast.error(messageFrom(error));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    if (
      submitting.current ||
      resendAfter > 0 ||
      !confirmationEmail
    ) {
      return;
    }

    submitting.current = true;
    setBusy(true);

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: confirmationEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });

      if (error) throw error;

      setResendAfter(60);
      toast.success(
        "If this account needs confirmation, a new link has been sent"
      );
    } catch (error) {
      toast.error(messageFrom(error));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink-gradient p-10 text-ink-foreground md:flex">
        <Logo inverted />

        <p className="max-w-sm font-display text-3xl font-semibold leading-snug">
          Every inflow, a little locked away. The rest, yours.
        </p>

        <p className="text-xs text-ink-foreground/50">
          All transactions are simulated in this MVP.
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 md:hidden">
            <Logo />
          </div>

          {sent ? (
            <div>
              <h1 className="text-2xl font-bold">
                Check your email
              </h1>

              <p className="mt-3 text-sm text-muted-foreground">
                If your account needs verification, a confirmation
                link will be sent to{" "}
                <strong className="break-all">
                  {confirmationEmail}
                </strong>
                . Click it to verify your email and return to
                SaveFlow.
              </p>

              <p className="mt-3 text-sm text-muted-foreground">
                Check your spam or junk folder too. If you already
                confirmed this email, return to sign in.
              </p>

              <Button
                type="button"
                variant="outline"
                className="mt-6 w-full"
                disabled={busy || resendAfter > 0}
                onClick={resendConfirmation}
              >
                {busy
                  ? "Sending…"
                  : resendAfter > 0
                    ? `Resend available in ${resendAfter}s`
                    : "Resend confirmation email"}
              </Button>

              <Button
                type="button"
                variant="link"
                className="mt-3 px-0"
                disabled={busy}
                onClick={() => {
                  setSent(false);
                  setMode("in");
                }}
              >
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold">
                {mode === "in"
                  ? "Welcome back"
                  : "Create your account"}
              </h1>

              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "in"
                  ? "Sign in to see your savings."
                  : "Create an account, then confirm your email to get started."}
              </p>

              <form
                onSubmit={submit}
                className="mt-6 space-y-4"
              >
                {mode === "up" && (
                  <>
                    <Field id="auth-name" label="Full name">
                      <Input
                        id="auth-name"
                        autoComplete="name"
                        required
                        maxLength={80}
                        disabled={busy}
                        value={form.name}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            name: event.target.value,
                          })
                        }
                      />
                    </Field>

                    <Field id="auth-phone" label="Phone">
                      <Input
                        id="auth-phone"
                        type="tel"
                        autoComplete="tel"
                        placeholder="080..."
                        maxLength={20}
                        disabled={busy}
                        value={form.phone}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            phone: event.target.value,
                          })
                        }
                      />
                    </Field>
                  </>
                )}

                <Field id="auth-email" label="Email">
                  <Input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    required
                    disabled={busy}
                    value={form.email}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        email: event.target.value,
                      })
                    }
                  />
                </Field>

                <Field id="auth-password" label="Password">
                  <Input
                    id="auth-password"
                    type="password"
                    autoComplete={
                      mode === "in"
                        ? "current-password"
                        : "new-password"
                    }
                    required
                    minLength={mode === "up" ? 6 : undefined}
                    disabled={busy}
                    value={form.password}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        password: event.target.value,
                      })
                    }
                  />
                </Field>

                <Button
                  type="submit"
                  className="h-11 w-full"
                  disabled={busy}
                >
                  {busy
                    ? "Please wait…"
                    : mode === "in"
                      ? "Sign in"
                      : "Create account"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "in"
                  ? "New to SaveFlow?"
                  : "Already have an account?"}{" "}
                <button
                  type="button"
                  className="font-semibold text-primary"
                  disabled={busy}
                  onClick={() => {
                    setMode(mode === "in" ? "up" : "in");
                    setForm((current) => ({
                      ...current,
                      password: "",
                    }));
                  }}
                >
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

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}