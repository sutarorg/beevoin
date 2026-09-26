import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { webhookEvents } from "@/db/schema";
import { requirePermissionPage } from "@/lib/auth/admin";
import { formatDateTime } from "@/lib/format";
import { HANDLED_EVENTS } from "@/lib/payments/webhook";
import {
  EmptyRow,
  Note,
  PageHeader,
  Pagination,
  Panel,
  Pill,
  StatCard,
  TableWrap,
  Td,
  Th,
} from "@/components/admin/ui";
import { adminInput } from "@/components/admin/forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Webhooks" };

const PAGE_SIZE = 40;

export default async function AdminWebhooksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermissionPage("webhooks.view");
  const params = await searchParams;
  const filter =
    (Array.isArray(params.state) ? params.state[0] : params.state) ?? "all";
  const page =
    Number((Array.isArray(params.page) ? params.page[0] : params.page) ?? 1) || 1;

  const where =
    filter === "processed"
      ? eq(webhookEvents.processed, true)
      : filter === "unprocessed"
        ? eq(webhookEvents.processed, false)
        : undefined;

  const [rows, total, counts] = await Promise.all([
    db
      .select()
      .from(webhookEvents)
      .where(where)
      .orderBy(desc(webhookEvents.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(webhookEvents)
      .where(where)
      .then((r) => r[0]?.count ?? 0),
    db
      .select({
        all: sql<number>`count(*)::int`,
        processed: sql<number>`count(*) filter (where ${webhookEvents.processed})::int`,
        failed: sql<number>`count(*) filter (where ${webhookEvents.error} is not null)::int`,
      })
      .from(webhookEvents)
      .then((r) => r[0]),
  ]);

  const configured = Boolean(process.env.RAZORPAY_WEBHOOK_SECRET);

  return (
    <>
      <PageHeader
        title="Webhooks"
        subtitle="Razorpay events received by the server, verified by signature and de-duplicated by event ID."
      />

      {!configured ? (
        <div className="mb-4">
          <Note tone="warn">
            RAZORPAY_WEBHOOK_SECRET is not set, so <code>/api/webhooks/razorpay</code>{" "}
            replies 503 and rejects every delivery. Add the secret and register
            the endpoint in the Razorpay dashboard.
          </Note>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Events received" value={counts.all} />
        <StatCard label="Processed" value={counts.processed} tone="accent" />
        <StatCard
          label="With errors"
          value={counts.failed}
          tone={counts.failed > 0 ? "warn" : "default"}
        />
      </div>

      <div className="mt-5">
        <Panel
          title="Event log"
          description={`Handled types: ${HANDLED_EVENTS.join(", ")}`}
        >
          <form
            method="get"
            className="flex flex-wrap gap-2.5 border-b border-sandline px-5 py-4"
          >
            <select
              name="state"
              defaultValue={filter}
              aria-label="Processing state"
              className={`${adminInput} max-w-[12rem]`}
            >
              <option value="all">All events</option>
              <option value="processed">Processed</option>
              <option value="unprocessed">Not processed</option>
            </select>
            <button
              type="submit"
              className="min-h-10 rounded-full bg-ink px-5 text-sm font-bold text-paper hover:bg-black"
            >
              Filter
            </button>
          </form>

          <TableWrap>
            <thead>
              <tr>
                <Th>Event</Th>
                <Th>Event ID</Th>
                <Th>Result</Th>
                <Th>Received</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={4}>
                  No webhook deliveries yet. Razorpay will appear here the moment
                  it calls the endpoint.
                </EmptyRow>
              ) : (
                rows.map((event) => (
                  <tr key={event.id}>
                    <Td>
                      <span className="font-extrabold text-ink">
                        {event.eventType}
                      </span>
                      {typeof event.summary?.paymentId === "string" ? (
                        <span className="block font-mono text-[11px] text-ink-faint">
                          {String(event.summary.paymentId)}
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <span className="font-mono text-[11px]">{event.eventId}</span>
                    </Td>
                    <Td>
                      <Pill
                        tone={
                          event.error
                            ? "bad"
                            : event.processed
                              ? "good"
                              : "warn"
                        }
                      >
                        {event.error
                          ? "error"
                          : event.processed
                            ? "processed"
                            : "pending"}
                      </Pill>
                      {typeof event.summary?.note === "string" ? (
                        <span className="mt-1 block text-[11px] font-semibold text-ink-faint">
                          {String(event.summary.note)}
                        </span>
                      ) : null}
                      {event.error ? (
                        <span className="mt-1 block text-[11px] font-semibold text-chili">
                          {event.error}
                        </span>
                      ) : null}
                    </Td>
                    <Td>{formatDateTime(event.createdAt)}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>

          <Pagination
            page={page}
            pages={Math.max(Math.ceil(total / PAGE_SIZE), 1)}
            total={total}
            basePath="/admin/webhooks"
            params={{ state: filter }}
          />
        </Panel>
      </div>
    </>
  );
}
