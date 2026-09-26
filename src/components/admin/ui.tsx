import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Small presentational kit shared by every admin page.
 *
 * Deliberately plain: the admin is an operations tool, not marketing surface.
 * It reuses the storefront's design tokens so the two never look unrelated,
 * but it adds no brand chrome of its own.
 */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-[13.5px] text-ink-soft">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  description,
  children,
  className,
  actions,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-sandline bg-white shadow-[0_1px_2px_rgb(29_25_18/0.04)]",
        className,
      )}
    >
      {title ? (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-sandline px-5 py-3.5">
          <div>
            <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-ink-faint">
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-[13px] text-ink-soft">{description}</p>
            ) : null}
          </div>
          {actions}
        </header>
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
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-[12px] font-extrabold uppercase tracking-wider text-ink-faint">
        {label}
      </p>
      <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-ink">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[12.5px] text-ink-soft">{hint}</p>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-2xl border border-sandline bg-white p-5 transition hover:border-ink-faint/50"
      >
        {body}
      </Link>
    );
  }
  return (
    <div className="rounded-2xl border border-sandline bg-white p-5">{body}</div>
  );
}

/* ----------------------------- table ----------------------------- */

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-[13.5px]">
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
        "border-b border-sandline px-4 py-2.5 text-[11.5px] font-extrabold uppercase tracking-wider text-ink-faint",
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
    <td className={cn("border-b border-sandline/70 px-4 py-3 align-top", className)}>
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
        className="px-4 py-10 text-center text-[13.5px] text-ink-soft"
      >
        {children}
      </td>
    </tr>
  );
}

/* --------------------------- status pills -------------------------- */

const TONES = {
  neutral: "bg-cream text-ink-soft",
  green: "bg-leaf-soft text-leaf",
  amber: "bg-haldi-soft text-haldi",
  red: "bg-chili-soft text-chili",
  ink: "bg-ink text-paper",
} as const;

export type PillTone = keyof typeof TONES;

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: PillTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-extrabold",
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

const ORDER_STATUS_TONES: Record<string, PillTone> = {
  pending: "neutral",
  payment_pending: "amber",
  confirmed: "green",
  processing: "amber",
  shipped: "amber",
  out_for_delivery: "amber",
  delivered: "green",
  cancelled: "red",
  refunded: "red",
};

const PAYMENT_TONES: Record<string, PillTone> = {
  pending: "neutral",
  created: "neutral",
  authorized: "amber",
  captured: "green",
  paid: "green",
  failed: "red",
  refunded: "red",
  partially_refunded: "amber",
  not_applicable: "neutral",
};

export function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function OrderStatusPill({ status }: { status: string }) {
  return <Pill tone={ORDER_STATUS_TONES[status] ?? "neutral"}>{humanize(status)}</Pill>;
}

export function PaymentStatusPill({ status }: { status: string }) {
  return <Pill tone={PAYMENT_TONES[status] ?? "neutral"}>{humanize(status)}</Pill>;
}

/* ----------------------------- alerts ----------------------------- */

export function Notice({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "warning" | "error";
  children: ReactNode;
}) {
  const styles = {
    neutral: "border-sandline bg-cream text-ink-soft",
    success: "border-leaf/30 bg-leaf-soft text-leaf",
    warning: "border-haldi/30 bg-haldi-soft text-haldi",
    error: "border-chili/30 bg-chili-soft text-chili",
  } as const;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-2xl border px-4 py-3 text-[13.5px] font-semibold",
        styles[tone],
      )}
    >
      {children}
    </div>
  );
}

export const adminInput =
  "w-full rounded-xl border-[1.5px] border-sandline bg-white px-3.5 py-2 text-[14px] text-ink outline-none transition focus:border-ink-faint focus:ring-2 focus:ring-ink/10 disabled:opacity-60";

export const adminButton =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[13px] font-bold text-paper transition hover:bg-ink/90 disabled:opacity-50";

export const adminButtonGhost =
  "inline-flex items-center justify-center gap-1.5 rounded-full border-[1.5px] border-sandline bg-white px-4 py-2 text-[13px] font-bold text-ink transition hover:border-ink-faint disabled:opacity-50";

export const adminButtonDanger =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-chili px-4 py-2 text-[13px] font-bold text-white transition hover:bg-chili/90 disabled:opacity-50";

/* --------------------------- pagination --------------------------- */

export function Pagination({
  page,
  pageCount,
  total,
  basePath,
  params,
}: {
  page: number;
  pageCount: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const href = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value);
    }
    search.set("page", String(target));
    return `${basePath}?${search.toString()}`;
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-[13px]">
      <p className="font-semibold text-ink-soft">
        {total === 0
          ? "No results"
          : `Page ${page} of ${pageCount} · ${total} result${total === 1 ? "" : "s"}`}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={adminButtonGhost}>
            ← Previous
          </Link>
        ) : (
          <span className={cn(adminButtonGhost, "opacity-40")}>← Previous</span>
        )}
        {page < pageCount ? (
          <Link href={href(page + 1)} className={adminButtonGhost}>
            Next →
          </Link>
        ) : (
          <span className={cn(adminButtonGhost, "opacity-40")}>Next →</span>
        )}
      </div>
    </div>
  );
}
