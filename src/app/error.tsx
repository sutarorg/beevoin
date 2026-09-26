"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Card, Container, Section, buttonClasses } from "@/components/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log only non-sensitive error metadata — never user data.
    console.error("route_error", error.digest ?? "unknown");
  }, [error]);

  return (
    <Section className="pt-20 pb-20">
      <Container className="max-w-md">
        <Card className="flex flex-col items-center gap-4 p-10 text-center">
          <span className="rounded-full bg-chili-soft p-5">
            <TriangleAlert className="size-8 text-chili" aria-hidden />
          </span>
          <h1 className="font-display text-2xl font-semibold text-ink">
            Something broke on our side
          </h1>
          <p className="text-sm leading-relaxed text-ink-soft">
            Don&apos;t worry — your cart and orders are safe. Try again, or
            come back in a minute.
          </p>
          <div className="flex flex-wrap justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={reset}
              className={buttonClasses()}
            >
              <RotateCcw className="size-4.5" aria-hidden />
              Try again
            </button>
            <Link href="/contact" className={buttonClasses({ variant: "secondary" })}>
              Contact support
            </Link>
          </div>
        </Card>
      </Container>
    </Section>
  );
}
