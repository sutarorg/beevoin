import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/admin";
import { roleHasPermission } from "@/lib/auth/permissions";
import { listEmails } from "@/lib/admin/queries";
import { emailDeliveryStates } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import { RetryEmailForm } from "@/components/admin/settings-forms";
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

export const metadata: Metadata = { title: "Emails" };

/**
 * Transactional email log.
 *
 * Rendered HTML is deliberately not stored — a retry re-renders from the
 * order, so the log holds no customer PII beyond the recipient address.
 */
export default async function AdminEmailsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const actor = await requirePermission("emails.view");
  const params = await searchParams;

  const result = await listEmails({
    q: params.q,
    delivery: params.delivery,
    page: params.page,
  });
  const canRetry = roleHasPermission(actor.role, "emails.retry");
  const resendConfigured = Boolean(process.env.RESEND_API_KEY);

  return (
    <>
      <PageHeader
        title="Emails"
        description="Every transactional email Beevo attempted, with its delivery outcome. Sends are idempotent — the same event can never email a customer twice."
      />

      {!resendConfigured ? (
        <div className="mb-5">
          <Notice tone="warning">
            RESEND_API_KEY is not set on this deployment. Emails are logged as
            skipped and nothing is delivered.
          </Notice>
        </div>
      ) : null}

      <Panel>
        <FilterBar
          action="/admin/emails"
          placeholder="Recipient, subject or template"
          q={params.q}
          selects={[
            {
              name: "delivery",
              label: "Delivery",
              value: params.delivery,
              options: emailDeliveryStates.map((state) => ({
                value: state,
                label: humanize(state),
              })),
            },
          ]}
        />

        <Table>
          <thead>
            <tr>
              <Th>Template</Th>
              <Th>To</Th>
              <Th>Subject</Th>
              <Th>Order</Th>
              <Th>Delivery</Th>
              <Th>Attempts</Th>
              <Th>When</Th>
              {canRetry ? <Th /> : null}
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <EmptyRow colSpan={canRetry ? 8 : 7}>
                No emails logged yet.
              </EmptyRow>
            ) : (
              result.rows.map((email) => (
                <tr key={email.id} className="hover:bg-cream/50">
                  <Td className="font-semibold">{humanize(email.template)}</Td>
                  <Td className="text-ink-soft">{email.toEmail}</Td>
                  <Td className="max-w-xs text-ink-soft">{email.subject}</Td>
                  <Td className="font-mono text-[12.5px]">
                    {email.orderId && email.orderNumber ? (
                      <Link
                        href={`/admin/orders/${email.orderId}`}
                        className="hover:underline"
                      >
                        {email.orderNumber}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    <Pill
                      tone={
                        email.delivery === "sent"
                          ? "green"
                          : email.delivery === "failed"
                            ? "red"
                            : "neutral"
                      }
                    >
                      {humanize(email.delivery)}
                    </Pill>
                    {email.error ? (
                      <span className="mt-1 block max-w-xs text-[12px] text-chili">
                        {email.error}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="font-mono tabular-nums">{email.attempts}</Td>
                  <Td className="whitespace-nowrap text-ink-soft">
                    {formatDateTime(email.createdAt)}
                  </Td>
                  {canRetry ? (
                    <Td>
                      {email.delivery === "failed" && email.orderId ? (
                        <RetryEmailForm emailLogId={email.id} />
                      ) : null}
                    </Td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </Table>

        <Pagination
          page={result.page}
          pageCount={result.pageCount}
          total={result.total}
          basePath="/admin/emails"
          params={params}
        />
      </Panel>
    </>
  );
}
