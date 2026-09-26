"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Loader2, Lock } from "lucide-react";
import { signInAction, type LoginState } from "@/app/admin/login/actions";
import { adminInput } from "@/components/admin/ui";

/**
 * Admin sign-in form.
 *
 * Credentials are posted to a Server Action and verified by Supabase Auth.
 * Nothing is validated for real on the client, no token is ever handled here,
 * and the error text is intentionally identical for "wrong password" and
 * "no such user".
 */

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-[15px] font-bold text-paper transition hover:bg-ink/90 disabled:opacity-50"
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Signing in…
        </>
      ) : (
        <>
          <Lock className="size-4" aria-hidden />
          Sign in
        </>
      )}
    </button>
  );
}

export function AdminLoginForm({ configured }: { configured: boolean }) {
  const [state, formAction] = useActionState<LoginState, FormData>(
    signInAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      {!configured ? (
        <div className="rounded-2xl border border-haldi/30 bg-haldi-soft px-4 py-3 text-[13.5px] font-semibold text-haldi">
          Supabase Auth is not configured on this deployment. Admin sign-in is
          disabled until the environment variables are set.
        </div>
      ) : null}

      {state && !state.ok ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-chili/30 bg-chili-soft px-4 py-3"
        >
          <AlertCircle className="mt-0.5 size-4.5 shrink-0 text-chili" aria-hidden />
          <p className="text-[13.5px] font-bold text-chili">{state.message}</p>
        </div>
      ) : null}

      <div>
        <label
          htmlFor="admin-email"
          className="mb-1.5 block text-[13px] font-bold text-ink"
        >
          Admin email
        </label>
        <input
          id="admin-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          disabled={!configured}
          placeholder="you@yourstore.in"
          className={adminInput}
        />
      </div>

      <div>
        <label
          htmlFor="admin-password"
          className="mb-1.5 block text-[13px] font-bold text-ink"
        >
          Password
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={!configured}
          className={adminInput}
        />
      </div>

      <Submit />

      <p className="text-center text-[12.5px] leading-relaxed text-ink-faint">
        Accounts are created in Supabase Auth and granted access from{" "}
        <span className="font-semibold">/admin/admins</span>. Signing up on the
        storefront never grants admin access.
      </p>
    </form>
  );
}
