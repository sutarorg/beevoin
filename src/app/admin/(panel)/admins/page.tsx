import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/admin";
import { roleHasPermission, ROLE_DESCRIPTIONS } from "@/lib/auth/permissions";
import { listAdminUsers } from "@/lib/admin/queries";
import { formatDateTime } from "@/lib/format";
import {
  CreateAdminUserForm,
  UpdateAdminUserForm,
} from "@/components/admin/settings-forms";
import {
  EmptyRow,
  Notice,
  PageHeader,
  Panel,
  Pill,
  Table,
  Td,
  Th,
  humanize,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin users" };

/**
 * Admin users.
 *
 * A Supabase Auth user becomes an admin only by being linked here. There is
 * no self-service signup path into the admin, no hardcoded account, and no
 * shared password — suspending a row revokes access on the very next request.
 */
export default async function AdminUsersPage() {
  const actor = await requirePermission("admins.view");
  const admins = await listAdminUsers();
  const canManage = roleHasPermission(actor.role, "admins.manage");

  return (
    <>
      <PageHeader
        title="Admin users"
        description="Who can sign in to this panel, and what each of them may do."
      />

      <div className="mb-5">
        <Notice>
          Access is granted per Supabase Auth user. Suspending someone takes
          effect on their next request — there is no long-lived Beevo session
          cookie to wait out.
        </Notice>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Panel title="Current admins">
          <Table>
            <thead>
              <tr>
                <Th>Person</Th>
                <Th>Role & status</Th>
                <Th>Last sign-in</Th>
                <Th>Added</Th>
              </tr>
            </thead>
            <tbody>
              {admins.length === 0 ? (
                <EmptyRow colSpan={4}>
                  No admin users yet. Add the first one using the form.
                </EmptyRow>
              ) : (
                admins.map((admin) => (
                  <tr key={admin.id}>
                    <Td>
                      <span className="block font-semibold text-ink">
                        {admin.name}
                        {admin.id === actor.id ? (
                          <span className="ml-1.5 text-[12px] font-bold text-ink-faint">
                            (you)
                          </span>
                        ) : null}
                      </span>
                      <span className="block text-[12.5px] text-ink-soft">
                        {admin.email}
                      </span>
                    </Td>
                    <Td>
                      {canManage ? (
                        <UpdateAdminUserForm
                          adminUserId={admin.id}
                          role={admin.role}
                          status={admin.status}
                          isSelf={admin.id === actor.id}
                        />
                      ) : (
                        <div className="flex gap-1.5">
                          <Pill tone="ink">{humanize(admin.role)}</Pill>
                          <Pill
                            tone={admin.status === "active" ? "green" : "red"}
                          >
                            {humanize(admin.status)}
                          </Pill>
                        </div>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-ink-soft">
                      {admin.lastLoginAt
                        ? formatDateTime(admin.lastLoginAt)
                        : "Never"}
                    </Td>
                    <Td className="whitespace-nowrap text-ink-soft">
                      {formatDateTime(admin.createdAt)}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </Panel>

        <div className="space-y-5">
          {canManage ? (
            <Panel title="Grant access">
              <CreateAdminUserForm />
            </Panel>
          ) : null}

          <Panel title="What each role can do">
            <ul className="divide-y divide-sandline/70">
              {Object.entries(ROLE_DESCRIPTIONS).map(([role, description]) => (
                <li key={role} className="px-5 py-3 text-[13.5px]">
                  <span className="font-bold text-ink">{humanize(role)}</span>
                  <p className="mt-0.5 text-ink-soft">{description}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
