import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/admin";
import { listRefunds } from "@/lib/admin/queries";
import { refundStatuses } from "@/db/schema";
import { formatDateTime, formatINR } from "@/lib/format";
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
  humanize,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Refunds" };

export default async function AdminRefundsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission("refunds.view");
  const params = await searchParams;

  const result = await listRefunds({
    q: params.q,
    status: params.status,
    page: params.page,
  });

  return (
    <>
      <PageHeader
        title="Refunds"
        description="Refunds issued through the Razorpay API. Every one records who requested it and why."
      />

      <div className="mb-5">
        <Notice>
          Refunds are issued from an order&apos;s detail page, where the
          refundable balance is calculated from the captured payment. This list
          is the audit view.
        </Notice>
      </div>

      <Panel>
        <FilterBar
          action="/admin/refunds"
          placeholder="rfnd_…, order number or email"
          q={params.q}
          selects={[
            {
              name: "status",
              label: "Status",
              value: params.status,
              options: refundStatuses.map((status) => ({
                value: status,
                label: humanize(status),
              })),
            },
          ]}
        />

        <Table>
          <thead>
            <tr>
              <Th>Refund ID</Th>
              <Th>Order</Th>
              <Th>Amount</Th>
              <Th>Status</Th>
              <Th>Reason</Th>
              <Th>Requested by</Th>
              <Th>When</Th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <EmptyRow colSpan={7}>
                No refunds have been issued.
              </EmptyRow>
            ) : (
              result.rows.map((refund) => (
                <tr key={refund.id} className="hover:bg-cream/50">
                  <Td className="font-mono text-[12.5px]">
                    {refund.providerRefundId ?? refund.id.slice(0, 8)}
                  </Td>
                  <Td>
                    <Link
                      href={`/admin/orders/${refund.orderId}`}
                      className="font-mono font-bold text-ink hover:underline"
                    >
                      {refund.orderNumber}
                    </Link>
                  </Td>
                  <Td className="font-mono font-bold tabular-nums">
                    {formatINR(refund.amountInPaise)}
                  </Td>
                  <Td>
                    <Pill
                      tone={
                        refund.status === "processed"
                          ? "green"
                          : refund.status === "failed"
                            ? "red"
                            : "amber"
                      }
                    >
                      {humanize(refund.status)}
                    </Pill>
                    {refund.error ? (
                      <span className="mt-1 block text-[12px] text-chili">
                        {refund.error}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="max-w-xs text-ink-soft">
                    {refund.reason}
                    {refund.restockRequested ? (
                      <span className="mt-1 block text-[12px] font-semibold text-leaf">
                        Units returned to stock
                      </span>
                    ) : null}
                  </Td>
                  <Td className="text-ink-soft">{refund.requestedBy ?? "—"}</Td>
                  <Td className="whitespace-nowrap text-ink-soft">
                    {formatDateTime(refund.createdAt)}
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
          basePath="/admin/refunds"
          params={params}
        />
      </Panel>
    </>
  );
}
