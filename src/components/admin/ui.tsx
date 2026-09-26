import type { ReactNode } from "react";
import Link from "next/link";
import type { OrderStatus } from "@/db/schema";
import { STATUS_META } from "@/lib/order-status";
import { cn } from "@/lib/cn";

/**
 * Presentational building blocks shared by the admin panel.
 * Server components only — no state, no client bundle cost.
 */

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-[1.75rem]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-[13px] font-semibold text-ink-faint">
            {subtitle}
          </p>
        ) : null}
      </div>
      {action}
    </header>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-sandline bg-card shadow-lift",
        className,
      )}
    >
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sandline px-5 py-3.5">
          <div>
            <h2 className="text-sm font-extrabold tracking-tight text-ink">
              {title}
            </h2>
            {description ? (
              <p className="text-xs font-semibold text-ink-faint">{description}</p>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  tone?: "default" | "accent" | "warn";
}) {
  const body = (
    <div
      className={cn(
        "h-full rounded-2xl border border-sandline bg-card p-4 shadow-lift transition-colors",
        href && "hover:border-ink-faint/60",
        tone === "warn" && "border-chili/40 bg-chili-soft/40",
      )}
    >
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-faint">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 font-display text-2xl font-semibold text-ink",
          tone === "accent" && "text-accent-deep",
          tone === "warn" && "text-chili",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-xs font-semibold text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

/* ---------- Tables ---------- */

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-sandline bg-cream/60 px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink-faint",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "border-b border-sandline/70 px-4 py-3 align-middle text-[13px] font-semibold text-ink-soft",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function EmptyRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: ReactNode;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-4 py-10 text-center text-[13px] font-semibold text-ink-faint"
      >
        {children}
      </td>
    </tr>
  );
}

/* ---------- Status pills ---------- */

const STATUS_TONE: Record<OrderStatus, string> = {
  pending: "bg-cream text-ink-soft",
  payment_pending: "bg-haldi-soft text-haldi",
  confirmed: "bg-accent-soft text-accent-deep",
  processing: "bg-accent-soft text-accent-deep",
  shipped: "bg-leaf-soft text-leaf",
  out_for_delivery: "bg-leaf-soft text-leaf",
  delivered: "bg-leaf-soft text-leaf",
  cancelled: "bg-chili-soft text-chili",
  refunded: "bg-ink text-paper",
};

export function StatusPill({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.06em]",
        STATUS_TONE[status] ?? "bg-cream text-ink-soft",
      )}
    >
      {STATUS_META[status]?.label ?? status}
    </span>
  );
}

const GENERIC_TONE: Record<string, string> = {
  good: "bg-leaf-soft text-leaf",
  warn: "bg-haldi-soft text-haldi",
  bad: "bg-chili-soft text-chili",
  muted: "bg-cream text-ink-soft",
  dark: "bg-ink text-paper",
};

export function Pill({
  tone = "muted",
  children,
}: {
  tone?: keyof typeof GENERIC_TONE;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.06em]",
        GENERIC_TONE[tone],
      )}
    >
      {children}
    </span>
  );
}

export function paymentTone(status: string): keyof typeof GENERIC_TONE {
  if (status === "paid" || status === "captured") return "good";
  if (status === "pending" || status === "authorized") return "warn";
  if (status === "failed") return "bad";
  if (status.includes("refund")) return "dark";
  return "muted";
}

/* ---------- Pagination ---------- */

export function Pagination({
  page,
  pages,
  total,
  basePath,
  params,
}: {
  page: number;
  pages: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const link = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value);
    }
    search.set("page", String(target));
    return `${basePath}?${search.toString()}`;
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-[13px] font-semibold text-ink-faint">
      <p>
        Page {page} of {pages} · {total} record{total === 1 ? "" : "s"}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={link(page - 1)}
            className="rounded-full border border-sandline px-3.5 py-1.5 font-bold text-ink hover:bg-cream"
          >
            Previous
          </Link>
        ) : null}
        {page < pages ? (
          <Link
            href={link(page + 1)}
            className="rounded-full border border-sandline px-3.5 py-1.5 font-bold text-ink hover:bg-cream"
          >
            Next
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- Misc ---------- */

export function DefinitionList({
  items,
}: {
  items: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <dl className="divide-y divide-sandline/70">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-2.5"
        >
          <dt className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink-faint">
            {item.label}
          </dt>
          <dd className="text-[13px] font-bold text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Note({
  tone = "muted",
  children,
}: {
  tone?: "muted" | "warn";
  children: ReactNode;
}) {
  return (
    <p
      className={cn(
        "rounded-xl px-4 py-3 text-[13px] font-semibold",
        tone === "warn"
          ? "bg-haldi-soft text-haldi"
          : "bg-cream text-ink-soft",
      )}
    >
      {children}
    </p>
  );
}
