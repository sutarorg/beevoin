import Link from "next/link";
import { Mail, ShieldCheck, Truck, Undo2 } from "lucide-react";
import { payments, policies, site } from "@/lib/config";
import { Container } from "./ui";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Shop",
    links: [
      { href: "/", label: "Beevo Go printer" },
      { href: "/cart", label: "Your cart" },
      { href: "/track", label: "Track your order" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/contact", label: "Contact us" },
      { href: "/shipping", label: "Shipping policy" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms & conditions" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-sandline bg-cream/60">
      <Container className="py-12 md:py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-sm space-y-4">
            <p className="font-display text-2xl font-bold tracking-tight text-ink">
              beevo<span className="text-accent">.</span>
            </p>
            <p className="text-sm leading-relaxed text-ink-soft">
              {site.tagline} A pocket-size Bluetooth thermal printer for notes,
              labels, lists and little everyday prints — no ink, ever.
            </p>
            <a
              href={`mailto:${site.supportEmail}`}
              className="inline-flex items-center gap-2 text-sm font-bold text-accent-deep hover:underline"
            >
              <Mail className="size-4" aria-hidden />
              {site.supportEmail}
            </a>
            <p className="text-xs text-ink-faint">{site.supportHours}</p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title} className="space-y-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink-faint">
                {col.title}
              </p>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm font-semibold text-ink-soft transition-colors hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 grid gap-3 rounded-2xl border border-sandline bg-card p-5 text-[13px] font-semibold text-ink-soft sm:grid-cols-3">
          <p className="flex items-center gap-2">
            <Truck className="size-4 text-leaf" aria-hidden />
            Free shipping · {policies.deliveryEstimate}
          </p>
          <p className="flex items-center gap-2">
            <Undo2 className="size-4 text-leaf" aria-hidden />
            {policies.replacementWindowDays}-day replacement for defects
          </p>
          <p className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-leaf" aria-hidden />
            {payments.razorpayEnabled
              ? "UPI, cards & netbanking via Razorpay · COD"
              : "Cash on Delivery available across India"}
          </p>
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-3 border-t border-sandline pt-6 text-xs text-ink-faint sm:flex-row sm:items-center">
          <p>
            © {new Date().getFullYear()} {site.legalName}. All prices include
            GST.
          </p>
          <p className="flex items-center gap-4">
            <span>Made for little prints in India</span>
            <Link
              href="/admin"
              className="font-semibold hover:text-ink"
              aria-label="Store admin"
            >
              Store admin
            </Link>
          </p>
        </div>
      </Container>
    </footer>
  );
}
