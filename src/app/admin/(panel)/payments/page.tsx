import Link from "next/link";
import { requirePermissionPage } from "@/lib/auth/admin";
import { searchPayments } from "@/lib/admin-metrics";
import { formatDateTime, formatINR } from "@/lib/format";
import {
  EmptyRow,
  PageHeader,
  Pagination,
  Panel,
  Pill,
  TableWrap,
  Td,
  Th,
  paymentTone,
} from "@/components/admin/ui";
import { adminInput } from "@/components/admin/forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payments" };

const STATUSES = [
  "all",
  "created",
  "pending",
  "authorized",
  "captured",
  "failed",
  "refunded",
  "partially_refunded",
];

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermissionPage("payments.view");
  const params = await searchParams;
  const status = (Array.isArray(params.status) ? params.status[0] : params.status) ?? "all";
  const page = Number((Array.isArray(params.page) ? params.page[0] : params.page) ?? 1) || 1;

  const result = await searchPayments({ status, page });

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Every Razorpay attempt recorded by the server, verified independently of the browser."
      />

      <Panel>
        <form
          method="get"
          className="flex flex-wrap gap-2.5 border-b border-sandline px-5 py-4"
        >
          <select
            name="status"
            defaultValue={status}
            aria-label="Payment status"
            className={`${adminInput} max-w-[14rem]`}
          >
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "All statuses" : value.replace(/_/g, " ")}
              </option>
            ))}
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
              <Th>Payment</Th>
              <Th>Order</Th>
              <Th>Method</Th>
              <Th>Status</Th>
              <Th>When</Th>
              <Th className="text-right">Amount</Th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <EmptyRow colSpan={6}>No payments recorded yet.</EmptyRow>
            ) : (
              result.rows.map(({ payment, orderNumber, orderId, customerName }) => (
                <tr key={payment.id} className="hover:bg-cream/50">
                  <Td>
                    <span className="font-mono text-[12px] font-bold text-ink">
                      {payment.providerPaymentId ?? "attempt started"}
                    </span>
                    <span className="block font-mono text-[11px] text-ink-faint">
                      {payment.providerOrderId}
                    </span>
                  </Td>
                  <Td>
                    <Link
                      href={`/admin/orders/${orderId}`}
                      className="font-extrabold text-ink hover:text-accent-deep"
                    >
                      {orderNumber}
                    </Link>
                    <span className="block text-[12px] font-semibold text-ink-faint">
                      {customerName}
                    </span>
                  </Td>
                  <Td>{payment.method ?? "—"}</Td>
                  <Td>
                    <Pill tone={paymentTone(payment.status)}>{payment.status}</Pill>
                    {payment.errorDescription ? (
                      <span className="mt-1 block text-[11px] font-semibold text-chili">
                        {payment.errorDescription}
                      </span>
                    ) : null}
                  </Td>
                  <Td>{formatDateTime(payment.createdAt)}</Td>
                  <Td className="text-right font-extrabold text-ink">
                    {formatINR(payment.amountInPaise)}
                    {payment.amountRefundedInPaise > 0 ? (
                      <span className="block text-[12px] font-bold text-chili">
                        −{formatINR(payment.amountRefundedInPaise)}
                      </span>
                    ) : null}
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
          basePath="/admin/payments"
          params={{ status }}
        />
      </Panel>
    </>
  );
}
