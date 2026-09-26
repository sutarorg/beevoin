import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

/* ---------- Layout ---------- */

export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-5 md:px-8", className)}>
      {children}
    </div>
  );
}

export function Section({
  id,
  children,
  className,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("py-14 md:py-20", className)}>
      {children}
    </section>
  );
}

export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-2.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-ink-faint",
        className,
      )}
    >
      <span className="h-px w-6 bg-accent" aria-hidden />
      {children}
    </p>
  );
}

/**
 * Section heading. `as="h1"` exists because several standalone pages (FAQ,
 * the legal pages) use this as their single page heading — a page whose only
 * heading is an <h2> is a real on-page SEO defect, not a styling detail.
 */
export function SectionTitle({
  children,
  className,
  as: Tag = "h2",
}: {
  children: ReactNode;
  className?: string;
  as?: "h1" | "h2";
}) {
  return (
    <Tag
      className={cn(
        "font-display text-[1.7rem] leading-[1.12] font-semibold tracking-tight text-ink md:text-4xl",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/* ---------- Buttons ---------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "dark";
type ButtonSize = "md" | "lg" | "sm";

export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return cn(
    "inline-flex select-none items-center justify-center gap-2 rounded-full font-bold transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    size === "lg" && "min-h-13 px-7 text-base",
    size === "md" && "min-h-11 px-6 text-[15px]",
    size === "sm" && "min-h-9 px-4 text-sm",
    variant === "primary" &&
      "bg-accent text-white shadow-[0_6px_18px_-6px_rgb(228_82_14/0.55)] hover:bg-accent-deep",
    variant === "secondary" &&
      "border-[1.5px] border-ink bg-transparent text-ink hover:bg-ink hover:text-paper",
    variant === "dark" && "bg-ink text-paper hover:bg-black",
    variant === "ghost" && "text-ink underline-offset-4 hover:underline",
    className,
  );
}

/* ---------- Badges & chips ---------- */

type BadgeTone = "leaf" | "accent" | "neutral" | "chili" | "haldi" | "dark";

const badgeTones: Record<BadgeTone, string> = {
  leaf: "bg-leaf-soft text-leaf",
  accent: "bg-accent-soft text-accent-deep",
  neutral: "bg-cream text-ink-soft",
  chili: "bg-chili-soft text-chili",
  haldi: "bg-haldi-soft text-haldi",
  dark: "bg-ink text-paper",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function TrustChip({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ink-soft">
      <span className="text-leaf [&>svg]:size-4" aria-hidden>
        {icon}
      </span>
      {children}
    </span>
  );
}

/**
 * Five-star rating with fractional fill (4.8 → four full stars + 80% of the
 * fifth). Empty stars use sandline so the row stays visible on white cards.
 */
export function StarRating({
  rating,
  className,
  starClassName,
}: {
  rating: number;
  className?: string;
  starClassName?: string;
}) {
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
  const stars = (fill: boolean) =>
    Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        aria-hidden
        className={cn("size-4 shrink-0", starClassName)}
        fill={fill ? "currentColor" : "none"}
        strokeWidth={fill ? 0 : 1.75}
      />
    ));
  return (
    <span
      className={cn("relative inline-flex", className)}
      role="img"
      aria-label={`Rated ${rating} out of 5 stars`}
    >
      <span className="flex gap-0.5 text-sandline">{stars(false)}</span>
      <span
        className="absolute inset-y-0 left-0 overflow-hidden text-star"
        style={{ width: `${pct}%` }}
        aria-hidden
      >
        <span className="flex w-max gap-0.5">{stars(true)}</span>
      </span>
    </span>
  );
}

/* ---------- Cards ---------- */

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-sandline bg-card shadow-lift",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ---------- Forms ---------- */

export function Field({
  label,
  error,
  hint,
  htmlFor,
  children,
  optional,
}: {
  label: string;
  error?: string;
  hint?: string;
  htmlFor: string;
  children: ReactNode;
  optional?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="flex items-baseline justify-between text-sm font-bold text-ink"
      >
        {label}
        {optional ? (
          <span className="text-xs font-semibold text-ink-faint">Optional</span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-[13px] font-semibold text-chili">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputClasses = (invalid?: boolean) =>
  cn(
    "min-h-12 w-full rounded-xl border-[1.5px] bg-white px-4 text-[15px] font-semibold text-ink placeholder:font-medium placeholder:text-ink-faint/70 transition-colors",
    invalid
      ? "border-chili focus:border-chili"
      : "border-sandline hover:border-ink-faint/60 focus:border-ink",
  );
