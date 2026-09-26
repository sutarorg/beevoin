import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLogs } from "@/db/schema";
import { requirePermissionPage } from "@/lib/auth/admin";
import { AUDIT_ACTIONS } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";
import {
  EmptyRow,
  PageHeader,
  Pagination,
  Panel,
  TableWrap,
  Td,
  Th,
} from "@/components/admin/ui";
import { adminInput } from "@/components/admin/forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit log" };

const PAGE_SIZE = 50;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermissionPage("audit.view");
  const params = await searchParams;
  const action =
    (Array.isArray(params.action) ? params.action[0] : params.action) ?? "all";
  const page =
    Number((Array.isArray(params.page) ? params.page[0] : params.page) ?? 1) || 1;

  const where = action !== "all" ? eq(adminAuditLogs.action, action) : undefined;

  const [rows, total] = await Promise.all([
    db
      .select()
      .from(adminAuditLogs)
      .where(where)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(adminAuditLogs)
      .where(where)
      .then((r) => r[0]?.count ?? 0),
  ]);

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Who did what, and when. Append-only — entries are never edited or deleted."
      />

      <Panel>
        <form
          method="get"
          className="flex flex-wrap gap-2.5 border-b border-sandline px-5 py-4"
        >
          <select
            name="action"
            defaultValue={action}
            aria-label="Action"
            className={`${adminInput} max-w-[16rem]`}
          >
            <option value="all">All actions</option>
            {AUDIT_ACTIONS.map((value) => (
              <option key={value} value={value}>
                {value.replace(/_/g, " ")}
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
              <Th>When</Th>
              <Th>Admin</Th>
              <Th>Action</Th>
              <Th>Entity</Th>
              <Th>Details</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={5}>Nothing logged for this filter.</EmptyRow>
            ) : (
              rows.map((entry) => (
                <tr key={entry.id}>
                  <Td>{formatDateTime(entry.createdAt)}</Td>
                  <Td>{entry.adminEmail ?? "system"}</Td>
                  <Td>
                    <span className="font-extrabold text-ink">
                      {entry.action.replace(/_/g, " ")}
                    </span>
                  </Td>
                  <Td>
                    {entry.entityType}
                    {entry.entityId ? (
                      <span className="block font-mono text-[11px] text-ink-faint">
                        {entry.entityId.slice(0, 8)}
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    <code className="text-[11px] text-ink-faint">
                      {Object.entries(entry.metadata ?? {})
                        .map(([key, value]) => `${key}=${String(value)}`)
                        .join(" · ") || "—"}
                    </code>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </TableWrap>

        <Pagination
          page={page}
          pages={Math.max(Math.ceil(total / PAGE_SIZE), 1)}
          total={total}
          basePath="/admin/audit"
          params={{ action }}
        />
      </Panel>
    </>
  );
}
