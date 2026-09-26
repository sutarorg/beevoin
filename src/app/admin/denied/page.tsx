import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { signOutAction } from "@/app/admin/login/actions";
import { adminButton, adminButtonGhost } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Access denied",
  robots: { index: false, follow: false },
};

const REASONS: Record<string, { title: string; body: string }> = {
  not_admin: {
    title: "This account has no admin access",
    body: "You are signed in, but your Supabase user is not linked to an active Beevo admin account. Ask the store owner to add you from the Admin users page.",
  },
  suspended: {
    title: "This admin account is suspended",
    body: "Your access has been suspended by the store owner. Existing sessions cannot perform any admin action while suspended.",
  },
  role: {
    title: "Your role cannot open this page",
    body: "You are an active admin, but this page is restricted to other roles.",
  },
  permission: {
    title: "Your role cannot perform this action",
    body: "You are an active admin, but this capability is not part of your role's permissions.",
  },
};

export default async function AdminDeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; need?: string }>;
}) {
  const params = await searchParams;
  const reason = REASONS[params.reason ?? ""] ?? {
    title: "Access denied",
    body: "You do not have permission to view that page.",
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-5 py-14">
      <div className="rounded-2xl border border-sandline bg-white p-8 text-center">
        <span className="mx-auto inline-flex rounded-full bg-chili-soft p-4">
          <ShieldAlert className="size-7 text-chili" aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-xl font-semibold text-ink">
          {reason.title}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
          {reason.body}
        </p>
        {params.need ? (
          <p className="mt-3 font-mono text-[12.5px] text-ink-faint">
            Required permission: {params.need}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <Link href="/admin" className={adminButtonGhost}>
            Back to dashboard
          </Link>
          <form action={signOutAction}>
            <button type="submit" className={adminButton}>
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
