import Link from "next/link";
import { requirePermissionPage } from "@/lib/auth/admin";
import { searchRefunds } from "@/lib/refunds";
import { formatDateTime, formatINR } from "@/lib/format";
import {
  EmptyRow,
  Note,
  PageHeader,
  Pagination,
  Panel,
  Pill,
  TableWrap,
  Td,
  Th,
} from "@/components/admin/ui";
import { adminInput } from "@/components/admin/forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Refunds" };

export default async function AdminRefundsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermissionPage("refunds.view");
  const params = await searchParams;
  const status = (Array.isArray(params.status) ? params.status[0] : params.status) ?? "all";
  const page = Number((Array.isArray(params.page) ? params.page[0] : params.page) ?? 1) || 1;

  const result = await searchRefunds({ status, page });

  return (
    <>
      <PageHeader
        title="Refunds"
        subtitle="Issued from an order page. Razorpay usually settles them in 5–7 working days."
      />

      <div className="mb-4">
        <Note>
          To issue a refund, open the order and use the refund panel — that way
          the amount, stock and customer email all stay in sync.
        </Note>
      </div>

      <Panel>
        <form
          method="get"
          className="flex flex-wrap gap-2.5 border-b border-sandline px-5 py-4"
        >
          <select
            name="status"
            defaultValue={status}
            aria-label="Refund status"
            className={`${adminInput} max-w-[12rem]`}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="processed">Processed</option>
            <option value="failed">Failed</option>
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
              <Th>Refund</Th>
              <Th>Order</Th>
              <Th>Reason</Th>
              <Th>Status</Th>
              <Th>Created</Th>
              <Th className="text-right">Amount</Th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <EmptyRow colSpan={6}>No refunds have been issued.</EmptyRow>
            ) : (
              result.rows.map(({ refund, orderNumber, orderId }) => (
                <tr key={refund.id} className="hover:bg-cream/50">
                  <Td>
                    <span className="font-mono text-[12px] font-bold text-ink">
                      {refund.providerRefundId ?? "—"}
                    </span>
                  </Td>
                  <Td>
                    <Link
                      href={`/admin/orders/${orderId}`}
                      className="font-extrabold text-ink hover:text-accent-deep"
                    >
                      {orderNumber}
                    </Link>
                  </Td>
                  <Td>{refund.reason}</Td>
                  <Td>
                    <Pill
                      tone={
                        refund.status === "processed"
                          ? "good"
                          : refund.status === "failed"
                            ? "bad"
                            : "warn"
                      }
                    >
                      {refund.status}
                    </Pill>
                    {refund.error ? (
                      <span className="mt-1 block text-[11px] font-semibold text-chili">
                        {refund.error}
                      </span>
                    ) : null}
                  </Td>
                  <Td>{formatDateTime(refund.createdAt)}</Td>
                  <Td className="text-right font-extrabold text-ink">
                    {formatINR(refund.amountInPaise)}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </TableWrap>

        <Pagination
          page={result.page}
          pages={result.pages}
          total={result.total}
          basePath="/admin/refunds"
          params={{ status }}
        />
      </Panel>
    </>
  );
}
