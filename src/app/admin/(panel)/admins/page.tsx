import { asc } from "drizzle-orm";
import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { requirePermissionPage } from "@/lib/auth/admin";
import { ROLE_DESCRIPTIONS } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/format";
import {
  EmptyRow,
  Note,
  PageHeader,
  Panel,
  Pill,
  TableWrap,
  Td,
  Th,
} from "@/components/admin/ui";
import { AdminUserRowForm, NewAdminForm } from "@/components/admin/ops-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admins" };

export default async function AdminUsersPage() {
  const me = await requirePermissionPage("admins.manage");
  const rows = await db
    .select()
    .from(adminUsers)
    .orderBy(asc(adminUsers.createdAt));

  return (
    <>
      <PageHeader
        title="Admin users"
        subtitle="Access is granted in two steps: create the person in Supabase Auth, then authorise them here."
      />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Team">
          <TableWrap>
            <thead>
              <tr>
                <Th>Person</Th>
                <Th>Role & status</Th>
                <Th>Last sign-in</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={4}>No admin users yet.</EmptyRow>
              ) : (
                rows.map((admin) => (
                  <tr key={admin.id}>
                    <Td>
                      <span className="font-extrabold text-ink">
                        {admin.name || admin.email}
                      </span>
                      <span className="block text-[12px] font-semibold text-ink-faint">
                        {admin.email}
                      </span>
                    </Td>
                    <Td>
                      <Pill tone={admin.status === "active" ? "good" : "bad"}>
                        {admin.role} · {admin.status}
                      </Pill>
                    </Td>
                    <Td>
                      {admin.lastLoginAt
                        ? formatDateTime(admin.lastLoginAt)
                        : "Never"}
                    </Td>
                    <Td>
                      <AdminUserRowForm admin={admin} isSelf={admin.id === me.id} />
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>
        </Panel>

        <div className="space-y-5">
          <Panel title="Grant access">
            <NewAdminForm />
          </Panel>

          <Panel title="What each role can do">
            <dl className="divide-y divide-sandline/70">
              {Object.entries(ROLE_DESCRIPTIONS).map(([role, summary]) => (
                <div key={role} className="px-5 py-3">
                  <dt className="text-[13px] font-extrabold text-ink capitalize">
                    {role}
                  </dt>
                  <dd className="text-[13px] font-semibold text-ink-soft">
                    {summary}
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>

          <div className="px-1">
            <Note>
              Passwords, resets and MFA are handled entirely by Supabase Auth —
              Beevo never stores a password. Suspending someone here blocks the
              admin instantly, even if their Supabase session is still valid.
            </Note>
          </div>
        </div>
      </div>
    </>
  );
}
