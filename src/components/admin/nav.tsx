"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/**
 * Horizontal admin navigation. Client-side only so the active tab can be
 * highlighted; the list of items it receives has already been filtered by the
 * server against the signed-in admin's role.
 */
export function AdminNav({
  items,
}: {
  items: { href: string; label: string }[];
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <nav
      aria-label="Admin sections"
      className="border-b border-sandline bg-white"
    >
      <div className="mx-auto max-w-7xl overflow-x-auto px-5 md:px-8">
        <ul className="flex min-w-max items-center gap-1 py-2">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "inline-flex rounded-full px-3.5 py-1.5 text-[13px] font-bold transition",
                  isActive(item.href)
                    ? "bg-ink text-paper"
                    : "text-ink-soft hover:bg-cream hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
