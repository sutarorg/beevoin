import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/admin";
import { listWebhookEvents } from "@/lib/admin/queries";
import { HANDLED_RAZORPAY_EVENTS } from "@/lib/services/webhooks";
import { formatDateTime } from "@/lib/format";
import { FilterBar } from "@/components/admin/filters";
import {
  EmptyRow,
  Notice,
  PageHeader,
  Pagination,
  Panel,
  Pill,
  Table,
  Td,
  Th,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Webhooks" };

/**
 * Razorpay webhook deliveries.
 *
 * Read-only. Each row is a signature-verified delivery; the unique
 * (provider, event_id) constraint means a replayed delivery is recorded once
 * and acknowledged without re-running any side effect.
 */
export default async function AdminWebhooksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission("webhooks.view");
  const params = await searchParams;

  const result = await listWebhookEvents({
    q: params.q,
    processed: params.processed,
    page: params.page,
  });

  const secretConfigured = Boolean(process.env.RAZORPAY_WEBHOOK_SECRET);

  return (
    <>
      <PageHeader
        title="Webhooks"
        description="Signature-verified Razorpay deliveries. Duplicates are detected by event ID and acknowledged without reprocessing."
      />

      {!secretConfigured ? (
        <div className="mb-5">
          <Notice tone="error">
            RAZORPAY_WEBHOOK_SECRET is not set. The webhook endpoint is
            returning 503 and payments will only be confirmed by the browser
            callback — configure it before going live.
          </Notice>
        </div>
      ) : null}

      <div className="mb-5">
        <Notice>
          Endpoint: <code>/api/webhooks/razorpay</code> · Events handled:{" "}
          {HANDLED_RAZORPAY_EVENTS.join(", ")}. Any other event is acknowledged
          and logged without touching an order.
        </Notice>
      </div>

      <Panel>
        <FilterBar
          action="/admin/webhooks"
          placeholder="Event ID or event type"
          q={params.q}
          selects={[
            {
              name: "processed",
              label: "Processed",
              value: params.processed,
              options: [
                { value: "true", label: "Processed" },
                { value: "false", label: "Not processed" },
              ],
            },
          ]}
        />

        <Table>
          <thead>
            <tr>
              <Th>Event</Th>
              <Th>Event ID</Th>
              <Th>Order</Th>
              <Th>Signature</Th>
              <Th>Processed</Th>
              <Th>Attempts</Th>
              <Th>Received</Th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <EmptyRow colSpan={7}>
                No webhook deliveries recorded yet.
              </EmptyRow>
            ) : (
              result.rows.map((event) => (
                <tr key={event.id} className="hover:bg-cream/50">
                  <Td className="font-semibold">{event.eventType}</Td>
                  <Td className="font-mono text-[12px]">{event.eventId}</Td>
                  <Td className="font-mono text-[12.5px]">
                    {event.orderNumber ? (
                      <Link
                        href={`/admin/orders?q=${event.orderNumber}`}
                        className="hover:underline"
                      >
                        {event.orderNumber}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    <Pill tone={event.signatureVerified ? "green" : "red"}>
                      {event.signatureVerified ? "Verified" : "Rejected"}
                    </Pill>
                  </Td>
                  <Td>
                    <Pill tone={event.processed ? "green" : "amber"}>
                      {event.processed ? "Yes" : "Pending"}
                    </Pill>
                    {event.error ? (
                      <span className="mt-1 block max-w-xs text-[12px] text-chili">
                        {event.error}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="font-mono tabular-nums">{event.attempts}</Td>
                  <Td className="whitespace-nowrap text-ink-soft">
                    {formatDateTime(event.createdAt)}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </Table>

        <Pagination
          page={result.page}
          pageCount={result.pageCount}
          total={result.total}
          basePath="/admin/webhooks"
          params={params}
        />
      </Panel>
    </>
  );
}
