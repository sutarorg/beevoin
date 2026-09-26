import { requirePermissionPage } from "@/lib/auth/admin";
import { roleHasPermission } from "@/lib/auth/permissions";
import { getStoreSettingsFresh } from "@/lib/settings";
import {
  DefinitionList,
  Note,
  PageHeader,
  Panel,
} from "@/components/admin/ui";
import { SettingsForm } from "@/components/admin/ops-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

function configured(...vars: string[]): string {
  return vars.every((name) => Boolean(process.env[name]))
    ? "Configured"
    : "Not configured";
}

export default async function AdminSettingsPage() {
  const admin = await requirePermissionPage("settings.view");
  const settings = await getStoreSettingsFresh();
  const canEdit = roleHasPermission(admin.role, "settings.update");

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Store details used across the storefront, legal pages and emails."
      />

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Panel title="Store details">
          {canEdit ? (
            <SettingsForm settings={settings} />
          ) : (
            <div className="px-5 py-5">
              <Note>Only an owner can change store settings.</Note>
            </div>
          )}
        </Panel>

        <div className="space-y-5">
          <Panel
            title="Integrations"
            description="Read from environment variables — change them in Vercel, then redeploy."
          >
            <DefinitionList
              items={[
                { label: "Database", value: configured("DATABASE_URL") },
                {
                  label: "Supabase Auth",
                  value: configured(
                    "NEXT_PUBLIC_SUPABASE_URL",
                    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
                  ),
                },
                {
                  label: "Razorpay",
                  value: configured("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"),
                },
                {
                  label: "Razorpay webhook",
                  value: configured("RAZORPAY_WEBHOOK_SECRET"),
                },
                {
                  label: "Resend",
                  value: configured("RESEND_API_KEY", "RESEND_FROM_EMAIL"),
                },
                {
                  label: "Razorpay mode",
                  value: process.env.RAZORPAY_KEY_ID?.startsWith("rzp_live")
                    ? "Live"
                    : process.env.RAZORPAY_KEY_ID
                      ? "Test"
                      : "—",
                },
              ]}
            />
          </Panel>

          <div className="px-1">
            <Note>
              Secrets are never displayed here — only whether each integration
              has the environment variables it needs.
            </Note>
          </div>
        </div>
      </div>
    </>
  );
}
