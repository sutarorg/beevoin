"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { Card, Container, Field, Section, buttonClasses, inputClasses } from "./ui";

export function AdminLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; redirect?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not sign in.");
        return;
      }
      router.replace(data.redirect ?? "/admin");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Section className="pt-24 pb-24">
      <Container className="max-w-sm">
        <Card className="p-8">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-cream">
            <Lock className="size-5.5 text-ink" aria-hidden />
          </span>
          <h1 className="mt-4 text-center font-display text-2xl font-semibold text-ink">
            Store admin
          </h1>
          <p className="mt-1 text-center text-[13px] font-semibold text-ink-faint">
            Authorised access only. All attempts are logged.
          </p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <Field label="Password" htmlFor="a-pass" error={error ?? undefined}>
              <input
                id="a-pass"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                className={inputClasses(Boolean(error))}
                autoComplete="current-password"
              />
            </Field>
            <button
              type="submit"
              disabled={loading || password.length === 0}
              className={buttonClasses({ className: "w-full", size: "lg" })}
            >
              {loading ? (
                <Loader2 className="size-4.5 animate-spin" aria-hidden />
              ) : null}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </Card>
      </Container>
    </Section>
  );
}
