import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { emailLogs, orders, type EmailDeliveryState } from "@/db/schema";
import { requirePermissionPage } from "@/lib/auth/admin";
import { roleHasPermission } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/format";
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
import { EmailRetryButton } from "@/components/admin/ops-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Emails" };

const PAGE_SIZE = 40;

export default async function AdminEmailsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requirePermissionPage("emails.view");
  const params = await searchParams;
  const delivery =
    (Array.isArray(params.delivery) ? params.delivery[0] : params.delivery) ??
    "all";
  const page =
    Number((Array.isArray(params.page) ? params.page[0] : params.page) ?? 1) || 1;

  const where =
    delivery !== "all"
      ? eq(emailLogs.delivery, delivery as EmailDeliveryState)
      : undefined;

  const [rows, total] = await Promise.all([
    db
      .select({
        log: emailLogs,
        orderNumber: orders.orderNumber,
        orderId: orders.id,
      })
      .from(emailLogs)
      .leftJoin(orders, eq(emailLogs.orderId, orders.id))
      .where(where)
      .orderBy(desc(emailLogs.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(emailLogs)
      .where(where)
      .then((r) => r[0]?.count ?? 0),
  ]);

  const canRetry = roleHasPermission(admin.role, "emails.retry");
  const resendConfigured = Boolean(process.env.RESEND_API_KEY);

  return (
    <>
      <PageHeader
        title="Emails"
        subtitle="Every transactional email the store has attempted, with its delivery state."
      />

      {!resendConfigured ? (
        <div className="mb-4">
          <Note tone="warn">
            RESEND_API_KEY is not set on this deployment, so emails are recorded
            as “skipped” instead of being delivered. Add the key in your
            environment to switch sending on.
          </Note>
        </div>
      ) : null}

      <Panel>
        <form
          method="get"
          className="flex flex-wrap gap-2.5 border-b border-sandline px-5 py-4"
        >
          <select
            name="delivery"
            defaultValue={delivery}
            aria-label="Delivery state"
            className={`${adminInput} max-w-[12rem]`}
          >
            <option value="all">All states</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="queued">Queued</option>
            <option value="skipped">Skipped</option>
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
              <Th>Template</Th>
              <Th>Recipient</Th>
              <Th>Order</Th>
              <Th>Delivery</Th>
              <Th>When</Th>
              {canRetry ? <Th /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={canRetry ? 6 : 5}>
                No emails logged yet.
              </EmptyRow>
            ) : (
              rows.map(({ log, orderNumber, orderId }) => (
                <tr key={log.id} className="hover:bg-cream/50">
                  <Td>
                    <span className="font-extrabold text-ink">{log.template}</span>
                    <span className="block text-[12px] font-semibold text-ink-faint">
                      {log.subject}
                    </span>
                  </Td>
                  <Td>{log.toEmail}</Td>
                  <Td>
                    {orderId ? (
                      <Link
                        href={`/admin/orders/${orderId}`}
                        className="font-bold text-accent-deep hover:underline"
                      >
                        {orderNumber}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    <Pill
                      tone={
                        log.delivery === "sent"
                          ? "good"
                          : log.delivery === "failed"
                            ? "bad"
                            : "muted"
                      }
                    >
                      {log.delivery}
                    </Pill>
                    {log.error ? (
                      <span className="mt-1 block text-[11px] font-semibold text-chili">
                        {log.error}
                      </span>
                    ) : null}
                    {log.attempts > 1 ? (
                      <span className="mt-1 block text-[11px] font-semibold text-ink-faint">
                        {log.attempts} attempts
                      </span>
                    ) : null}
                  </Td>
                  <Td>{formatDateTime(log.createdAt)}</Td>
                  {canRetry ? (
                    <Td>
                      {log.delivery === "sent" ? null : (
                        <EmailRetryButton emailLogId={log.id} />
                      )}
                    </Td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </TableWrap>

        <Pagination
          page={page}
          pages={Math.max(Math.ceil(total / PAGE_SIZE), 1)}
          total={total}
          basePath="/admin/emails"
          params={{ delivery }}
        />
      </Panel>
    </>
  );
}
