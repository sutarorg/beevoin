import { Container } from "@/components/ui";

export default function Loading() {
  return (
    <Container className="py-16">
      <div className="animate-pulse space-y-6" aria-label="Loading page">
        <div className="h-9 w-56 rounded-xl bg-cream" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="aspect-square rounded-3xl bg-cream" />
          <div className="space-y-4">
            <div className="h-6 w-3/4 rounded-xl bg-cream" />
            <div className="h-6 w-1/2 rounded-xl bg-cream" />
            <div className="h-14 w-full rounded-full bg-cream" />
            <div className="h-14 w-full rounded-full bg-cream" />
          </div>
        </div>
      </div>
      <span className="sr-only" role="status">
        Loading…
      </span>
    </Container>
  );
}
