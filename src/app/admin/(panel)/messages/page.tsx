import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { contactMessages, type ContactStatus } from "@/db/schema";
import { requirePermissionPage } from "@/lib/auth/admin";
import { roleHasPermission } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/format";
import {
  PageHeader,
  Pagination,
  Panel,
  Pill,
} from "@/components/admin/ui";
import { adminInput } from "@/components/admin/forms";
import { MessageForm } from "@/components/admin/ops-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages" };

const PAGE_SIZE = 25;

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requirePermissionPage("messages.view");
  const params = await searchParams;
  const status =
    (Array.isArray(params.status) ? params.status[0] : params.status) ?? "all";
  const page =
    Number((Array.isArray(params.page) ? params.page[0] : params.page) ?? 1) || 1;

  const where =
    status !== "all"
      ? eq(contactMessages.status, status as ContactStatus)
      : undefined;

  const [rows, total] = await Promise.all([
    db
      .select()
      .from(contactMessages)
      .where(where)
      .orderBy(desc(contactMessages.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(contactMessages)
      .where(where)
      .then((r) => r[0]?.count ?? 0),
  ]);

  const canResolve = roleHasPermission(admin.role, "messages.resolve");

  return (
    <>
      <PageHeader
        title="Messages"
        subtitle="Contact form submissions. Replying happens in your email client; track the state here."
      />

      <Panel>
        <form
          method="get"
          className="flex flex-wrap gap-2.5 border-b border-sandline px-5 py-4"
        >
          <select
            name="status"
            defaultValue={status}
            aria-label="Message status"
            className={`${adminInput} max-w-[12rem]`}
          >
            <option value="all">All messages</option>
            <option value="new">New</option>
            <option value="read">Read</option>
            <option value="resolved">Resolved</option>
          </select>
          <button
            type="submit"
            className="min-h-10 rounded-full bg-ink px-5 text-sm font-bold text-paper hover:bg-black"
          >
            Filter
          </button>
        </form>

        <ul className="divide-y divide-sandline">
          {rows.length === 0 ? (
            <li className="px-5 py-10 text-center text-[13px] font-semibold text-ink-faint">
              No messages here.
            </li>
          ) : (
            rows.map((message) => (
              <li key={message.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[14px] font-extrabold text-ink">
                      {message.name}{" "}
                      <span className="font-semibold text-ink-faint">
                        · {message.email}
                        {message.phone ? ` · +91 ${message.phone}` : ""}
                      </span>
                    </p>
                    <p className="text-[12px] font-semibold text-ink-faint">
                      {formatDateTime(message.createdAt)} · {message.topic}
                      {message.orderNumber ? ` · ${message.orderNumber}` : ""}
                    </p>
                  </div>
                  <Pill
                    tone={
                      message.status === "resolved"
                        ? "good"
                        : message.status === "new"
                          ? "warn"
                          : "muted"
                    }
                  >
                    {message.status}
                  </Pill>
                </div>

                <p className="mt-2 whitespace-pre-line rounded-xl bg-cream px-4 py-3 text-[13px] font-semibold text-ink-soft">
                  {message.message}
                </p>

                <div className="mt-2 flex flex-wrap gap-3">
                  <a
                    href={`mailto:${message.email}?subject=Re: your Beevo message`}
                    className="text-[13px] font-bold text-accent-deep hover:underline"
                  >
                    Reply by email
                  </a>
                  {message.orderNumber ? (
                    <a
                      href={`/admin/orders?q=${message.orderNumber}`}
                      className="text-[13px] font-bold text-accent-deep hover:underline"
                    >
                      Find the order
                    </a>
                  ) : null}
                </div>

                {canResolve ? <MessageForm message={message} /> : null}
              </li>
            ))
          )}
        </ul>

        <Pagination
          page={page}
          pages={Math.max(Math.ceil(total / PAGE_SIZE), 1)}
          total={total}
          basePath="/admin/messages"
          params={{ status }}
        />
      </Panel>
    </>
  );
}
