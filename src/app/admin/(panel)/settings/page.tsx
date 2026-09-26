import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/admin";
import { roleHasPermission } from "@/lib/auth/permissions";
import { getStoreSettings } from "@/lib/services/settings";
import { SettingsForm } from "@/components/admin/settings-forms";
import {
  Notice,
  PageHeader,
  Panel,
  Pill,
  Table,
  Td,
  Th,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Settings" };

/**
 * Store settings.
 *
 * Only NON-SECRET operational values are editable here. Secrets (database
 * URL, Razorpay keys, webhook secret, Resend key, Supabase keys) are
 * environment variables, are never read into this page, and are shown below
 * purely as configured / not configured booleans.
 */
export default async function AdminSettingsPage() {
  const actor = await requirePermission("settings.view");
  const settings = await getStoreSettings();
  const canEdit = roleHasPermission(actor.role, "settings.update");

  const integrations = [
    {
      name: "Database (DATABASE_URL)",
      configured: Boolean(process.env.DATABASE_URL ?? process.env.POSTGRES_URL),
      note: "PostgreSQL via Drizzle — all application data.",
    },
    {
      name: "Supabase Auth",
      configured: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      ),
      note: "Admin identity only. No customer data lives in Supabase.",
    },
    {
      name: "Razorpay API keys",
      configured: Boolean(
        process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET,
      ),
      note: "Required for online payments and refunds.",
    },
    {
      name: "Razorpay webhook secret",
      configured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
      note: "Required so payments confirm even if the customer closes the tab.",
    },
    {
      name: "Resend",
      configured: Boolean(process.env.RESEND_API_KEY),
      note: "All transactional email.",
    },
  ];

  return (
    <>
      <PageHeader
        title="Settings"
        description="Operational copy and contact details. Credentials are environment variables and are never editable from the browser."
      />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Store details">
          {canEdit ? (
            <SettingsForm values={settings} />
          ) : (
            <div className="space-y-2 px-5 py-5 text-[13.5px]">
              <Notice>
                Only the store owner can change settings. Current values are
                shown below.
              </Notice>
              <dl className="mt-3 space-y-1.5">
                {Object.entries(settings).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-4">
                    <dt className="text-ink-soft">{key}</dt>
                    <dd className="text-right font-semibold text-ink">
                      {value || "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </Panel>

        <Panel
          title="Integrations"
          description="Read-only status. Values are never displayed."
        >
          <Table>
            <thead>
              <tr>
                <Th>Service</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {integrations.map((integration) => (
                <tr key={integration.name}>
                  <Td>
                    <span className="block font-semibold text-ink">
                      {integration.name}
                    </span>
                    <span className="block text-[12.5px] text-ink-soft">
                      {integration.note}
                    </span>
                  </Td>
                  <Td>
                    <Pill tone={integration.configured ? "green" : "red"}>
                      {integration.configured ? "Configured" : "Missing"}
                    </Pill>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="px-5 py-4">
            <Notice>
              Rate limiting is in-memory and therefore per serverless instance —
              it is a speed bump, not a distributed limiter. See the README for
              how to move it to a shared store.
            </Notice>
          </div>
        </Panel>
      </div>
    </>
  );
}
