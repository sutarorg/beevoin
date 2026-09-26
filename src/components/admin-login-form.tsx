"use client";

import { useActionState } from "react";
import { Lock } from "lucide-react";
import { signInAction } from "@/app/admin/login/actions";
import { EMPTY_LOGIN_STATE } from "@/app/admin/action-state";
import { Card, Container, Field, Section, inputClasses } from "./ui";
import { SubmitButton } from "./admin/forms";

export function AdminLoginForm() {
  const [state, formAction] = useActionState(signInAction, EMPTY_LOGIN_STATE);

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
            Authorised access only. All sign-ins are logged.
          </p>

          <form action={formAction} className="mt-6 space-y-4">
            <Field label="Email" htmlFor="a-email">
              <input
                id="a-email"
                name="email"
                type="email"
                autoComplete="username"
                required
                className={inputClasses(Boolean(state.error))}
                placeholder="you@beevo.in"
              />
            </Field>
            <Field
              label="Password"
              htmlFor="a-pass"
              error={state.error ?? undefined}
            >
              <input
                id="a-pass"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className={inputClasses(Boolean(state.error))}
                placeholder="••••••••"
              />
            </Field>
            <SubmitButton className="w-full">Sign in</SubmitButton>
          </form>

          <p className="mt-5 text-center text-[12px] font-semibold text-ink-faint">
            Forgot your password? Reset it from the Supabase dashboard, or ask
            another owner to send you a recovery link.
          </p>
        </Card>
      </Container>
    </Section>
  );
}
