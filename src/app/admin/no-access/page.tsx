import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { getAdminAuth } from "@/lib/auth/admin";
import { signOutAction } from "../actions";
import { Card, Container, Section } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "No access",
  robots: { index: false, follow: false },
};

export default async function AdminNoAccessPage() {
  const auth = await getAdminAuth();

  const message =
    auth.state === "suspended"
      ? "This admin account has been suspended. An owner can reactivate it from Admin users."
      : auth.state === "not_admin"
        ? "You're signed in, but this account hasn't been granted admin access yet. Ask an owner to add your Supabase user ID under Admin users."
        : "Your role doesn't include this section.";

  return (
    <Section className="pt-24 pb-24">
      <Container className="max-w-md">
        <Card className="p-8 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-chili-soft">
            <ShieldAlert className="size-5.5 text-chili" aria-hidden />
          </span>
          <h1 className="mt-4 font-display text-2xl font-semibold text-ink">
            No access
          </h1>
          <p className="mt-2 text-[14px] font-semibold text-ink-soft">{message}</p>

          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              href="/"
              className="min-h-10 rounded-full border-[1.5px] border-sandline px-5 py-2 text-sm font-bold text-ink hover:border-ink"
            >
              Back to store
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="min-h-10 rounded-full bg-ink px-5 text-sm font-bold text-paper hover:bg-black"
              >
                Sign out
              </button>
            </form>
          </div>
        </Card>
      </Container>
    </Section>
  );
}
