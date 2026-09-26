import { Check, PackageCheck, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { STATUS_META, TIMELINE_STEPS } from "@/lib/order-status";
import type { OrderStatus } from "@/db/schema";

export type StepState = {
  key: OrderStatus;
  label: string;
  date?: string | null;
  state: "done" | "current" | "upcoming";
};

/**
 * Compute the timeline step states from an order's status + its event log.
 * Pure function — used by both the server-rendered success page and the
 * client-side tracking widget.
 */
export function buildStepStates(
  status: OrderStatus,
  events: {
    status: string;
    at?: Date | string | null;
    createdAt?: Date | string | null;
  }[],
): StepState[] {
  const currentIndex = TIMELINE_STEPS.indexOf(
    status as (typeof TIMELINE_STEPS)[number],
  );
  const latestAt = new Map<string, Date | string>();
  for (const e of events) {
    const when = e.at ?? e.createdAt;
    if (when) latestAt.set(e.status, when);
  }

  return TIMELINE_STEPS.map((key, i) => ({
    key,
    label: STATUS_META[key].label,
    date: latestAt.has(key) ? String(latestAt.get(key)) : null,
    state:
      status === "delivered" || i < currentIndex
        ? "done"
        : i === currentIndex
          ? "done"
          : "upcoming",
  }));
}

const TERMINAL_INFO: Partial<
  Record<OrderStatus, { tone: "good" | "bad"; title: string; body: string }>
> = {
  delivered: {
    tone: "good",
    title: "Delivered",
    body: "Your order has been delivered. Enjoy printing!",
  },
  cancelled: {
    tone: "bad",
    title: "Order cancelled",
    body: "This order was cancelled. Any advance payment is refunded to the original method within 5–7 business days.",
  },
  refunded: {
    tone: "bad",
    title: "Refund issued",
    body: "A refund has been issued to the original payment method. Banks usually reflect it within 5–7 business days.",
  },
};

export function OrderStatusBanner({ status }: { status: OrderStatus }) {
  const info = TERMINAL_INFO[status];
  if (status === "pending") {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-haldi/30 bg-haldi-soft p-4.5">
        <PackageCheck className="mt-0.5 size-5 shrink-0 text-haldi" aria-hidden />
        <div>
          <p className="text-sm font-extrabold text-haldi">Awaiting payment</p>
          <p className="mt-0.5 text-[13px] font-medium text-haldi/90">
            This order hasn&apos;t been paid yet. If you already paid, it will
            update automatically once verified.
          </p>
        </div>
      </div>
    );
  }
  if (!info) return null;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-4.5",
        info.tone === "good"
          ? "border-leaf/30 bg-leaf-soft"
          : "border-chili/30 bg-chili-soft",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
          info.tone === "good" ? "bg-leaf text-white" : "bg-chili text-white",
        )}
      >
        {info.tone === "good" ? (
          <Check className="size-3.5" aria-hidden />
        ) : (
          <X className="size-3.5" aria-hidden />
        )}
      </span>
      <div>
        <p
          className={cn(
            "text-sm font-extrabold",
            info.tone === "good" ? "text-leaf" : "text-chili",
          )}
        >
          {info.title}
        </p>
        <p
          className={cn(
            "mt-0.5 text-[13px] font-medium",
            info.tone === "good" ? "text-leaf/90" : "text-chili/90",
          )}
        >
          {info.body}
        </p>
      </div>
    </div>
  );
}

export function OrderTimeline({ steps }: { steps: StepState[] }) {
  return (
    <ol className="space-y-0">
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={step.key} className="relative flex gap-4 pb-6 last:pb-0">
            {!last ? (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[13px] top-8 h-full w-0.5",
                  step.state === "done" ? "bg-leaf/60" : "bg-sandline",
                )}
              />
            ) : null}
            <span
              className={cn(
                "z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2",
                step.state === "done"
                  ? "border-leaf bg-leaf text-white"
                  : "border-sandline bg-white text-transparent",
              )}
            >
              <Check className="size-4" aria-hidden />
            </span>
            <div className="pt-1">
              <p
                className={cn(
                  "text-[14.5px] font-extrabold",
                  step.state === "done" ? "text-ink" : "text-ink-faint",
                )}
              >
                {step.label}
              </p>
              {step.date ? (
                <p className="text-[12.5px] font-semibold text-ink-faint">
                  {step.date}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
