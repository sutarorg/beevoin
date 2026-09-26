"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import type { AdminUser, ContactMessage } from "@/db/schema";
import type { StoreSettings } from "@/lib/settings";
import {
  createAdminUserAction,
  retryEmailAction,
  updateAdminUserAction,
  updateMessageAction,
  updateSettingsAction,
} from "@/app/admin/actions";
import { EMPTY_STATE } from "@/app/admin/action-state";
import { AdminField, FormMessage, SubmitButton, adminInput } from "./forms";

/* ---------- Contact messages ---------- */

export function MessageForm({ message }: { message: ContactMessage }) {
  const [state, action] = useActionState(updateMessageAction, EMPTY_STATE);

  return (
    <form action={action} className="mt-3 space-y-2.5">
      <input type="hidden" name="messageId" value={message.id} />
      <div className="flex flex-wrap items-end gap-2.5">
        <select
          name="status"
          defaultValue={message.status}
          aria-label="Message status"
          className={`${adminInput} max-w-[10rem]`}
        >
          <option value="new">New</option>
          <option value="read">Read</option>
          <option value="resolved">Resolved</option>
        </select>
        <input
          name="adminNote"
          defaultValue={message.adminNote ?? ""}
          placeholder="Internal note"
          aria-label="Internal note"
          className={`${adminInput} flex-1 min-w-[12rem]`}
        />
        <SubmitButton variant="secondary">Save</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

/* ---------- Email retry ---------- */

export function EmailRetryButton({ emailLogId }: { emailLogId: string }) {
  const [state, action] = useActionState(retryEmailAction, EMPTY_STATE);

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="emailLogId" value={emailLogId} />
      <SubmitButton variant="secondary" className="min-h-8 px-3.5 text-[13px]">
        <RefreshCw className="size-3.5" aria-hidden />
        Resend
      </SubmitButton>
      {state.error ? (
        <span className="text-[12px] font-bold text-chili">{state.error}</span>
      ) : state.message ? (
        <span className="text-[12px] font-bold text-leaf">{state.message}</span>
      ) : null}
    </form>
  );
}

/* ---------- Store settings ---------- */

export function SettingsForm({ settings }: { settings: StoreSettings }) {
  const [state, action] = useActionState(updateSettingsAction, EMPTY_STATE);

  return (
    <form action={action} className="space-y-4 px-5 py-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <AdminField label="Store name" htmlFor="s-name">
          <input
            id="s-name"
            name="storeName"
            defaultValue={settings.storeName}
            className={adminInput}
          />
        </AdminField>
        <AdminField label="Legal entity name" htmlFor="s-legal">
          <input
            id="s-legal"
            name="legalName"
            defaultValue={settings.legalName}
            className={adminInput}
          />
        </AdminField>
        <AdminField
          label="Support email"
          htmlFor="s-support"
          hint="Shown on the storefront, legal pages and customer emails."
        >
          <input
            id="s-support"
            name="supportEmail"
            type="email"
            defaultValue={settings.supportEmail}
            className={adminInput}
          />
        </AdminField>
        <AdminField
          label="Admin notification email"
          htmlFor="s-notify"
          hint="Where new-order, contact and low-stock alerts are sent."
        >
          <input
            id="s-notify"
            name="adminNotificationEmail"
            type="email"
            defaultValue={settings.adminNotificationEmail ?? ""}
            className={adminInput}
          />
        </AdminField>
        <AdminField label="Support hours" htmlFor="s-hours">
          <input
            id="s-hours"
            name="supportHours"
            defaultValue={settings.supportHours}
            className={adminInput}
          />
        </AdminField>
        <AdminField label="Dispatch window" htmlFor="s-dispatch">
          <input
            id="s-dispatch"
            name="dispatchWindow"
            defaultValue={settings.dispatchWindow}
            className={adminInput}
          />
        </AdminField>
        <AdminField label="Delivery estimate" htmlFor="s-delivery">
          <input
            id="s-delivery"
            name="deliveryEstimate"
            defaultValue={settings.deliveryEstimate}
            className={adminInput}
          />
        </AdminField>
        <AdminField
          label="Replacement window (days)"
          htmlFor="s-window"
          hint="Used on the returns page and in emails."
        >
          <input
            id="s-window"
            name="replacementWindowDays"
            type="number"
            min={0}
            defaultValue={settings.replacementWindowDays}
            className={adminInput}
          />
        </AdminField>
      </div>

      <AdminField label="Business address" htmlFor="s-address">
        <textarea
          id="s-address"
          name="businessAddress"
          rows={3}
          defaultValue={settings.businessAddress}
          className={`${adminInput} min-h-20 py-2.5`}
        />
      </AdminField>

      <FormMessage state={state} />
      <SubmitButton>Save settings</SubmitButton>
    </form>
  );
}

/* ---------- Admin users ---------- */

export function NewAdminForm() {
  const [state, action] = useActionState(createAdminUserAction, EMPTY_STATE);

  return (
    <form action={action} className="space-y-3.5 px-5 py-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <AdminField
          label="Supabase user ID"
          htmlFor="au-id"
          hint="Supabase dashboard → Authentication → Users → copy the UID."
        >
          <input
            id="au-id"
            name="supabaseUserId"
            required
            placeholder="00000000-0000-0000-0000-000000000000"
            className={adminInput}
          />
        </AdminField>
        <AdminField label="Email" htmlFor="au-email">
          <input
            id="au-email"
            name="email"
            type="email"
            required
            className={adminInput}
          />
        </AdminField>
        <AdminField label="Name" htmlFor="au-name">
          <input id="au-name" name="name" className={adminInput} />
        </AdminField>
        <AdminField label="Role" htmlFor="au-role">
          <select
            id="au-role"
            name="role"
            defaultValue="support"
            className={adminInput}
          >
            <option value="owner">Owner — full access</option>
            <option value="admin">Admin — everything except settings</option>
            <option value="support">Support — read-only + messages</option>
            <option value="fulfillment">Fulfillment — orders & stock</option>
          </select>
        </AdminField>
      </div>
      <FormMessage state={state} />
      <SubmitButton>Grant admin access</SubmitButton>
    </form>
  );
}

export function AdminUserRowForm({
  admin,
  isSelf,
}: {
  admin: AdminUser;
  isSelf: boolean;
}) {
  const [state, action] = useActionState(updateAdminUserAction, EMPTY_STATE);

  if (isSelf) {
    return (
      <span className="text-[12px] font-semibold text-ink-faint">
        This is you
      </span>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="adminUserId" value={admin.id} />
      <select
        name="role"
        defaultValue={admin.role}
        aria-label={`Role for ${admin.email}`}
        className={`${adminInput} min-h-8 max-w-[9rem] text-[13px]`}
      >
        <option value="owner">Owner</option>
        <option value="admin">Admin</option>
        <option value="support">Support</option>
        <option value="fulfillment">Fulfillment</option>
      </select>
      <select
        name="status"
        defaultValue={admin.status}
        aria-label={`Status for ${admin.email}`}
        className={`${adminInput} min-h-8 max-w-[8rem] text-[13px]`}
      >
        <option value="active">Active</option>
        <option value="suspended">Suspended</option>
      </select>
      <SubmitButton variant="secondary" className="min-h-8 px-3.5 text-[13px]">
        Save
      </SubmitButton>
      {state.error ? (
        <span className="text-[12px] font-bold text-chili">{state.error}</span>
      ) : null}
    </form>
  );
}
