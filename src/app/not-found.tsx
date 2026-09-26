import Link from "next/link";
import { Compass } from "lucide-react";
import { Card, Container, Section, buttonClasses } from "@/components/ui";

export default function NotFound() {
  return (
    <Section className="pt-20 pb-20">
      <Container className="max-w-md">
        <Card className="flex flex-col items-center gap-4 p-10 text-center">
          <span className="rounded-full bg-cream p-5">
            <Compass className="size-8 text-ink-faint" aria-hidden />
          </span>
          <p className="font-mono text-sm font-bold text-accent">404</p>
          <h1 className="font-display text-2xl font-semibold text-ink">
            This page wandered off
          </h1>
          <p className="text-sm leading-relaxed text-ink-soft">
            The link might be old, or the page moved. The good stuff is one tap
            away.
          </p>
          <div className="flex flex-wrap justify-center gap-2.5 pt-1">
            <Link href="/" className={buttonClasses()}>
              Back to the store
            </Link>
            <Link href="/track" className={buttonClasses({ variant: "secondary" })}>
              Track an order
            </Link>
          </div>
        </Card>
      </Container>
    </Section>
  );
}
