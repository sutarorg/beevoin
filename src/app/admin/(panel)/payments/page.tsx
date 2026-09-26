import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/admin";
import { listPayments } from "@/lib/admin/queries";
import { paymentRecordStatuses } from "@/db/schema";
import { formatDateTime, formatINR } from "@/lib/format";
import { FilterBar } from "@/components/admin/filters";
import {
  EmptyRow,
  PageHeader,
  Pagination,
  Panel,
  PaymentStatusPill,
  Pill,
  Table,
  Td,
  Th,
  humanize,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Payments" };

/**
 * Gateway payments.
 *
 * Read-only by design: a payment record is written only by the server-side
 * reconciliation path (checkout callback or Razorpay webhook), never by hand.
 * Refunds are issued from the order page so they always carry a reason.
 */
export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission("payments.view");
  const params = await searchParams;

  const result = await listPayments({
    q: params.q,
    status: params.status,
    page: params.page,
  });

  return (
    <>
      <PageHeader
        title="Payments"
        description="Every Razorpay payment reconciled against an order. Records are created only by verified server-side reconciliation — never from the browser."
      />

      <Panel>
        <FilterBar
          action="/admin/payments"
          placeholder="pay_…, order_…, order number or email"
          q={params.q}
          selects={[
            {
              name: "status",
              label: "Status",
              value: params.status,
              options: paymentRecordStatuses.map((status) => ({
                value: status,
                label: humanize(status),
              })),
            },
          ]}
        />

        <Table>
          <thead>
            <tr>
              <Th>Payment ID</Th>
              <Th>Order</Th>
              <Th>Amount</Th>
              <Th>Refunded</Th>
              <Th>Method</Th>
              <Th>Status</Th>
              <Th>Verified</Th>
              <Th>When</Th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <EmptyRow colSpan={8}>No payments match these filters.</EmptyRow>
            ) : (
              result.rows.map((payment) => (
                <tr key={payment.id} className="hover:bg-cream/50">
                  <Td className="font-mono text-[12.5px]">
                    {payment.providerPaymentId ?? "—"}
                    {payment.failureReason ? (
                      <span className="mt-1 block font-sans text-[12px] text-chili">
                        {payment.failureReason}
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    <Link
                      href={`/admin/orders/${payment.orderId}`}
                      className="font-mono font-bold text-ink hover:underline"
                    >
                      {payment.orderNumber}
                    </Link>
                  </Td>
                  <Td className="font-mono font-bold tabular-nums">
                    {formatINR(payment.amountInPaise)}
                  </Td>
                  <Td className="font-mono tabular-nums">
                    {payment.amountRefundedInPaise > 0
                      ? formatINR(payment.amountRefundedInPaise)
                      : "—"}
                  </Td>
                  <Td className="uppercase text-ink-soft">
                    {payment.method ?? "—"}
                  </Td>
                  <Td>
                    <PaymentStatusPill status={payment.status} />
                  </Td>
                  <Td>
                    <Pill tone={payment.verified ? "green" : "amber"}>
                      {payment.verified ? "Verified" : "Unverified"}
                    </Pill>
                  </Td>
                  <Td className="whitespace-nowrap text-ink-soft">
                    {formatDateTime(payment.createdAt)}
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
          basePath="/admin/payments"
          params={params}
        />
      </Panel>
    </>
  );
}
