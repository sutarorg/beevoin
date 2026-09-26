import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Crumb } from "@/lib/seo";

/**
 * Visible breadcrumb trail. It pairs with the BreadcrumbList JSON-LD emitted
 * by the page: Google cross-checks structured data against what a user can
 * actually see, so the markup is never emitted without this trail on screen.
 */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5">
      <ol className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden whitespace-nowrap text-[12.5px] font-bold text-ink-faint sm:flex-wrap sm:whitespace-normal">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={crumb.path} className="flex min-w-0 shrink-0 items-center gap-1.5 last:shrink">
              {i > 0 ? (
                <ChevronRight className="size-3.5 text-ink-faint/60" aria-hidden />
              ) : null}
              {isLast ? (
                <span aria-current="page" className="truncate text-ink-soft">
                  {crumb.name}
                </span>
              ) : (
                <Link
                  href={crumb.path}
                  className="transition-colors hover:text-accent-deep"
                >
                  {crumb.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
