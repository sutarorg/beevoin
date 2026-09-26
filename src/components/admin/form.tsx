"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { adminButton, Notice } from "./ui";

/**
 * Thin client wrappers around React 19 form state.
 *
 * Every admin mutation is a Server Action; these components only render its
 * pending/result state. No authorization logic lives here — the server action
 * re-checks permissions on every call.
 */

export type ActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
} | null;

export function SubmitButton({
  children,
  className,
  pendingLabel = "Saving…",
  confirm,
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  /** Native confirm() prompt for destructive actions. */
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={
        confirm
          ? (event) => {
              if (!window.confirm(confirm)) event.preventDefault();
            }
          : undefined
      }
      className={cn(adminButton, className)}
    >
      {pending ? (
        <>
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function ActionForm({
  action,
  children,
  className,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: (state: ActionState) => React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {state && state.message ? (
        <div className="mb-4">
          <Notice tone={state.ok ? "success" : "error"}>{state.message}</Notice>
        </div>
      ) : null}
      {children(state)}
    </form>
  );
}
