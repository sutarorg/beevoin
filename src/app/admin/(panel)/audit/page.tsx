import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/admin";
import { listAuditLogs } from "@/lib/admin/queries";
import { AUDIT_ACTIONS } from "@/lib/services/audit";
import { formatDateTime } from "@/lib/format";
import { FilterBar } from "@/components/admin/filters";
import {
  EmptyRow,
  Notice,
  PageHeader,
  Pagination,
  Panel,
  Table,
  Td,
  Th,
  humanize,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Audit log" };

/**
 * Audit log.
 *
 * Append-only: there is no UI (and no server action) that edits or deletes an
 * entry. Metadata is sanitised on write — credentials and customer addresses
 * are stripped before anything is stored.
 */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission("audit.view");
  const params = await searchParams;

  const result = await listAuditLogs({
    q: params.q,
    action: params.action,
    page: params.page,
  });

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every privileged action, who performed it and when. Append-only — entries cannot be edited or deleted from this panel."
      />

      <div className="mb-5">
        <Notice>
          Metadata is sanitised before it is written: passwords, tokens, API
          keys and customer addresses are never recorded.
        </Notice>
      </div>

      <Panel>
        <FilterBar
          action="/admin/audit"
          placeholder="Admin email, entity type or entity ID"
          q={params.q}
          selects={[
            {
              name: "action",
              label: "Action",
              value: params.action,
              options: AUDIT_ACTIONS.map((action) => ({
                value: action,
                label: humanize(action),
              })),
            },
          ]}
        />

        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Admin</Th>
              <Th>Action</Th>
              <Th>Entity</Th>
              <Th>Details</Th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <EmptyRow colSpan={5}>No audit entries match.</EmptyRow>
            ) : (
              result.rows.map((entry) => (
                <tr key={entry.id} className="hover:bg-cream/50">
                  <Td className="whitespace-nowrap text-ink-soft">
                    {formatDateTime(entry.createdAt)}
                  </Td>
                  <Td className="font-semibold">
                    {entry.adminEmail ?? "system"}
                  </Td>
                  <Td>{humanize(entry.action)}</Td>
                  <Td className="text-ink-soft">
                    {entry.entityType}
                    {entry.entityId ? (
                      <span className="block font-mono text-[12px]">
                        {entry.entityId}
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    {entry.metadata ? (
                      <dl className="space-y-0.5 text-[12.5px]">
                        {Object.entries(entry.metadata).map(([key, value]) => (
                          <div key={key} className="flex gap-1.5">
                            <dt className="font-semibold text-ink-faint">
                              {key}:
                            </dt>
                            <dd className="font-mono text-ink-soft">
                              {String(value)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      "—"
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
          basePath="/admin/audit"
          params={params}
        />
      </Panel>
    </>
  );
}
