"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ActionState } from "@/app/admin/action-state";

/** Shared client-side form primitives for the admin panel. */

export function SubmitButton({
  children,
  variant = "primary",
  className,
  disabled,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={cn(
        "inline-flex min-h-10 select-none items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition-colors disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "bg-ink text-paper hover:bg-black",
        variant === "secondary" &&
          "border-[1.5px] border-sandline bg-white text-ink hover:border-ink",
        variant === "danger" && "bg-chili text-white hover:brightness-95",
        className,
      )}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state.error && !state.message) return null;
  return (
    <p
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-[13px] font-bold",
        state.ok ? "bg-leaf-soft text-leaf" : "bg-chili-soft text-chili",
      )}
    >
      {state.ok ? (
        <CheckCircle2 className="mt-px size-4 shrink-0" aria-hidden />
      ) : (
        <AlertCircle className="mt-px size-4 shrink-0" aria-hidden />
      )}
      {state.ok ? state.message : state.error}
    </p>
  );
}

export const adminInput =
  "min-h-10 w-full rounded-xl border-[1.5px] border-sandline bg-white px-3.5 text-[14px] font-semibold text-ink placeholder:font-medium placeholder:text-ink-faint/70 focus:border-ink";

export const adminLabel =
  "block text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink-faint";

export function AdminField({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className={adminLabel}>
        {label}
      </label>
      {children}
      {hint ? (
        <p className="text-[12px] font-semibold text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}
