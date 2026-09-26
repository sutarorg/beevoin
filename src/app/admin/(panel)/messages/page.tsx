import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/admin";
import { roleHasPermission } from "@/lib/auth/permissions";
import { listMessages } from "@/lib/admin/queries";
import { formatDateTime } from "@/lib/format";
import { MessageStatusForm } from "@/components/admin/settings-forms";
import {
  EmptyRow,
  PageHeader,
  Pagination,
  Panel,
  Pill,
  Table,
  Td,
  Th,
  humanize,
} from "@/components/admin/ui";
import { FilterBar } from "@/components/admin/filters";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Messages" };

/**
 * Contact-form messages.
 *
 * Every submission is stored here first and notified second, so a Resend
 * outage can lose a notification but never a customer's message.
 */
export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const actor = await requirePermission("messages.view");
  const params = await searchParams;

  const result = await listMessages({
    status: params.status,
    page: params.page,
  });
  const canResolve = roleHasPermission(actor.role, "messages.resolve");

  return (
    <>
      <PageHeader
        title="Messages"
        description="Customer enquiries from the contact form. Stored in the database first — notification email is best-effort on top."
      />

      <Panel>
        <FilterBar
          action="/admin/messages"
          placeholder="Filter by status below"
          q={undefined}
          selects={[
            {
              name: "status",
              label: "Status",
              value: params.status,
              options: [
                { value: "new", label: "New" },
                { value: "read", label: "Read" },
                { value: "resolved", label: "Resolved" },
              ],
            },
          ]}
        />

        <Table>
          <thead>
            <tr>
              <Th>From</Th>
              <Th>Topic</Th>
              <Th>Message</Th>
              <Th>Order</Th>
              <Th>Received</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <EmptyRow colSpan={6}>No messages.</EmptyRow>
            ) : (
              result.rows.map((message) => (
                <tr key={message.id} className="hover:bg-cream/50">
                  <Td>
                    <span className="block font-semibold text-ink">
                      {message.name}
                    </span>
                    <a
                      href={`mailto:${message.email}`}
                      className="block text-[12.5px] text-ink-soft hover:underline"
                    >
                      {message.email}
                    </a>
                    {message.phone ? (
                      <span className="block text-[12.5px] text-ink-soft">
                        +91 {message.phone}
                      </span>
                    ) : null}
                  </Td>
                  <Td>{humanize(message.topic)}</Td>
                  <Td className="max-w-md whitespace-pre-wrap text-ink-soft">
                    {message.message}
                  </Td>
                  <Td className="font-mono text-[12.5px]">
                    {message.orderNumber ?? "—"}
                  </Td>
                  <Td className="whitespace-nowrap text-ink-soft">
                    {formatDateTime(message.createdAt)}
                    {message.notifiedAt ? null : (
                      <span className="mt-1 block text-[12px] font-semibold text-haldi">
                        Alert email not delivered
                      </span>
                    )}
                  </Td>
                  <Td>
                    {canResolve ? (
                      <MessageStatusForm
                        messageId={message.id}
                        status={message.status}
                      />
                    ) : (
                      <Pill
                        tone={message.status === "resolved" ? "green" : "amber"}
                      >
                        {humanize(message.status)}
                      </Pill>
                    )}
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
          basePath="/admin/messages"
          params={params}
        />
      </Panel>
    </>
  );
}
