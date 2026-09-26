"use client";

import {
  adjustInventoryAction,
  createAdminUserAction,
  retryEmailAction,
  updateAdminUserAction,
  updateMessageStatusAction,
  updatePriceAction,
  updateProductAction,
  updateSettingsAction,
} from "@/app/admin/actions";
import { ActionForm, SubmitButton } from "./form";
import { adminInput, adminButtonGhost, Notice } from "./ui";

/**
 * Client forms for the product, inventory, settings, messages, emails and
 * admin-user pages. They are presentation only: validation and permissions
 * are enforced again inside every server action.
 */

function Label({
  htmlFor,
  children,
  hint,
}: {
  htmlFor: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-1">
      <label
        htmlFor={htmlFor}
        className="block text-[11.5px] font-extrabold uppercase tracking-wider text-ink-faint"
      >
        {children}
      </label>
      {hint ? (
        <p className="mt-0.5 text-[12px] font-medium text-ink-soft">{hint}</p>
      ) : null}
    </div>
  );
}

function FieldError({
  state,
  name,
}: {
  state: { fieldErrors?: Record<string, string> } | null;
  name: string;
}) {
  const message = state?.fieldErrors?.[name];
  if (!message) return null;
  return <p className="mt-1 text-[12px] font-bold text-chili">{message}</p>;
}

/* ---------------------------- product ---------------------------- */

export type ProductFormValues = {
  id: string;
  name: string;
  shortName: string;
  sku: string;
  shortDescription: string;
  description: string;
  active: boolean;
  maxPerOrder: number;
  lowStockThreshold: number;
  metaTitle: string;
  metaDescription: string;
  specificationsText: string;
  imagesText: string;
};

export function ProductForm({ product }: { product: ProductFormValues }) {
  return (
    <ActionForm action={updateProductAction} className="space-y-4 px-5 py-5">
      {(state) => (
        <>
          <input type="hidden" name="productId" value={product.id} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="p-name">Product name</Label>
              <input
                id="p-name"
                name="name"
                defaultValue={product.name}
                required
                className={adminInput}
              />
              <FieldError state={state} name="name" />
            </div>
            <div>
              <Label htmlFor="p-shortName">Short name</Label>
              <input
                id="p-shortName"
                name="shortName"
                defaultValue={product.shortName}
                required
                className={adminInput}
              />
              <FieldError state={state} name="shortName" />
            </div>
            <div>
              <Label htmlFor="p-sku">SKU</Label>
              <input
                id="p-sku"
                name="sku"
                defaultValue={product.sku}
                required
                className={adminInput}
              />
              <FieldError state={state} name="sku" />
            </div>
            <div>
              <Label
                htmlFor="p-max"
                hint="Enforced at checkout, not just in the UI."
              >
                Max units per order
              </Label>
              <input
                id="p-max"
                name="maxPerOrder"
                type="number"
                min={1}
                max={20}
                defaultValue={product.maxPerOrder}
                required
                className={adminInput}
              />
              <FieldError state={state} name="maxPerOrder" />
            </div>
            <div>
              <Label
                htmlFor="p-low"
                hint="Below this the dashboard warns you."
              >
                Low-stock threshold
              </Label>
              <input
                id="p-low"
                name="lowStockThreshold"
                type="number"
                min={0}
                defaultValue={product.lowStockThreshold}
                required
                className={adminInput}
              />
              <FieldError state={state} name="lowStockThreshold" />
            </div>
          </div>

          <div>
            <Label htmlFor="p-shortDesc">Short description</Label>
            <input
              id="p-shortDesc"
              name="shortDescription"
              defaultValue={product.shortDescription}
              maxLength={300}
              className={adminInput}
            />
          </div>

          <div>
            <Label htmlFor="p-desc">Full description</Label>
            <textarea
              id="p-desc"
              name="description"
              rows={5}
              defaultValue={product.description}
              className={adminInput}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="p-metaTitle">Meta title</Label>
              <input
                id="p-metaTitle"
                name="metaTitle"
                defaultValue={product.metaTitle}
                maxLength={160}
                className={adminInput}
              />
            </div>
            <div>
              <Label htmlFor="p-metaDesc">Meta description</Label>
              <input
                id="p-metaDesc"
                name="metaDescription"
                defaultValue={product.metaDescription}
                maxLength={320}
                className={adminInput}
              />
            </div>
          </div>

          <div>
            <Label
              htmlFor="p-specs"
              hint="One per line, as: Label | Value"
            >
              Specifications
            </Label>
            <textarea
              id="p-specs"
              name="specifications"
              rows={6}
              defaultValue={product.specificationsText}
              className={`${adminInput} font-mono text-[13px]`}
            />
          </div>

          <div>
            <Label
              htmlFor="p-images"
              hint="One per line, as: /images/product-1.jpg | Alt text. Paths must be local files already in /public."
            >
              Images
            </Label>
            <textarea
              id="p-images"
              name="images"
              rows={6}
              defaultValue={product.imagesText}
              className={`${adminInput} font-mono text-[13px]`}
            />
            <FieldError state={state} name="images" />
          </div>

          <label className="flex items-center gap-2.5 text-[13.5px] font-semibold text-ink">
            <input
              type="checkbox"
              name="active"
              defaultChecked={product.active}
              className="size-4 accent-[#1d1912]"
            />
            Sell this product on the storefront
          </label>

          <SubmitButton>Save product</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function PriceForm({
  productId,
  priceInPaise,
  codPriceInPaise,
  shippingInPaise,
}: {
  productId: string;
  priceInPaise: number;
  codPriceInPaise: number;
  shippingInPaise: number;
}) {
  return (
    <ActionForm action={updatePriceAction} className="space-y-3 px-5 py-5">
      {(state) => (
        <>
          <input type="hidden" name="productId" value={productId} />
          <Notice tone="warning">
            Changing the price affects NEW orders only. Existing orders keep the
            price they were placed at — order history is never rewritten.
          </Notice>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="price" hint="Stored as integer paise.">
                Online price (₹)
              </Label>
              <input
                id="price"
                name="priceInRupees"
                type="number"
                step="0.01"
                min="1"
                defaultValue={(priceInPaise / 100).toFixed(2)}
                required
                className={adminInput}
              />
              <FieldError state={state} name="priceInPaise" />
            </div>
            <div>
              <Label htmlFor="codPrice" hint="Charged only when Cash on Delivery is selected.">
                COD price (₹)
              </Label>
              <input
                id="codPrice"
                name="codPriceInRupees"
                type="number"
                step="0.01"
                min="1"
                defaultValue={(codPriceInPaise / 100).toFixed(2)}
                required
                className={adminInput}
              />
              <FieldError state={state} name="codPriceInPaise" />
            </div>
            <div>
              <Label htmlFor="shipping" hint="0 for free shipping.">
                Shipping (₹)
              </Label>
              <input
                id="shipping"
                name="shippingInRupees"
                type="number"
                step="0.01"
                min="0"
                defaultValue={(shippingInPaise / 100).toFixed(2)}
                required
                className={adminInput}
              />
              <FieldError state={state} name="shippingInPaise" />
            </div>
          </div>
          <SubmitButton confirm="Update the live selling price?">
            Update price
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

/* --------------------------- inventory --------------------------- */

export function InventoryForm({
  productId,
  currentQuantity,
}: {
  productId: string;
  currentQuantity: number;
}) {
  return (
    <ActionForm action={adjustInventoryAction} className="space-y-3 px-5 py-5">
      {(state) => (
        <>
          <input type="hidden" name="productId" value={productId} />
          <p className="text-[13.5px] text-ink-soft">
            Current stock:{" "}
            <span className="font-mono font-bold text-ink">
              {currentQuantity}
            </span>{" "}
            units. Adjustments are atomic and can never take stock below zero.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="direction">Direction</Label>
              <select id="direction" name="direction" className={adminInput}>
                <option value="add">Add stock</option>
                <option value="remove">Remove stock</option>
              </select>
            </div>
            <div>
              <Label htmlFor="units">Units</Label>
              <input
                id="units"
                name="units"
                type="number"
                min={1}
                required
                className={adminInput}
              />
              <FieldError state={state} name="delta" />
            </div>
            <div>
              <Label htmlFor="reason">Reason</Label>
              <select id="reason" name="reason" className={adminInput}>
                <option value="restock">Restock</option>
                <option value="manual_adjustment">Manual adjustment</option>
                <option value="initial_stock">Initial stock</option>
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="inv-note">Note (required, audit-logged)</Label>
            <input
              id="inv-note"
              name="note"
              required
              minLength={3}
              maxLength={300}
              placeholder="Received 40 units from supplier, invoice #1234"
              className={adminInput}
            />
            <FieldError state={state} name="note" />
          </div>

          <SubmitButton>Apply adjustment</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

/* ---------------------------- settings --------------------------- */

export function SettingsForm({
  values,
}: {
  values: Record<string, string>;
}) {
  const fields: { name: string; label: string; hint?: string; type?: string }[] =
    [
      { name: "store_name", label: "Store name" },
      { name: "legal_name", label: "Legal entity name" },
      { name: "support_email", label: "Customer support email", type: "email" },
      {
        name: "admin_notification_email",
        label: "Internal notification email",
        hint: "Where contact-form, low-stock and payment-failure alerts are sent.",
        type: "email",
      },
      { name: "business_address", label: "Business address" },
      { name: "support_hours", label: "Support hours" },
      { name: "dispatch_window", label: "Dispatch window" },
      { name: "delivery_estimate", label: "Delivery estimate" },
      {
        name: "replacement_window_days",
        label: "Replacement window (days)",
        type: "number",
      },
    ];

  return (
    <ActionForm action={updateSettingsAction} className="space-y-4 px-5 py-5">
      {(state) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.name}>
                <Label htmlFor={`s-${field.name}`} hint={field.hint}>
                  {field.label}
                </Label>
                <input
                  id={`s-${field.name}`}
                  name={field.name}
                  type={field.type ?? "text"}
                  defaultValue={values[field.name] ?? ""}
                  className={adminInput}
                />
                <FieldError state={state} name={field.name} />
              </div>
            ))}
          </div>
          <SubmitButton>Save settings</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

/* ---------------------------- messages --------------------------- */

export function MessageStatusForm({
  messageId,
  status,
}: {
  messageId: string;
  status: string;
}) {
  return (
    <ActionForm action={updateMessageStatusAction} className="flex items-center gap-2">
      {() => (
        <>
          <input type="hidden" name="messageId" value={messageId} />
          <select
            name="status"
            defaultValue={status}
            aria-label="Message status"
            className={`${adminInput} w-auto py-1.5 text-[13px]`}
          >
            <option value="new">New</option>
            <option value="read">Read</option>
            <option value="resolved">Resolved</option>
          </select>
          <SubmitButton className={adminButtonGhost} pendingLabel="…">
            Save
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

/* ----------------------------- emails ---------------------------- */

export function RetryEmailForm({ emailLogId }: { emailLogId: string }) {
  return (
    <ActionForm action={retryEmailAction}>
      {() => (
        <>
          <input type="hidden" name="emailLogId" value={emailLogId} />
          <SubmitButton className={adminButtonGhost} pendingLabel="Sending…">
            Resend
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

/* -------------------------- admin users -------------------------- */

export function CreateAdminUserForm() {
  return (
    <ActionForm action={createAdminUserAction} className="space-y-4 px-5 py-5">
      {(state) => (
        <>
          <Notice>
            Create the person in <strong>Supabase → Authentication → Users</strong>{" "}
            first, then paste their user UUID here. Beevo never creates Supabase
            accounts, and signing up on the storefront grants nothing.
          </Notice>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="a-uuid">Supabase user UUID</Label>
              <input
                id="a-uuid"
                name="supabaseUserId"
                required
                placeholder="00000000-0000-0000-0000-000000000000"
                className={`${adminInput} font-mono text-[13px]`}
              />
              <FieldError state={state} name="supabaseUserId" />
            </div>
            <div>
              <Label htmlFor="a-email">Email</Label>
              <input
                id="a-email"
                name="email"
                type="email"
                required
                className={adminInput}
              />
              <FieldError state={state} name="email" />
            </div>
            <div>
              <Label htmlFor="a-name">Full name</Label>
              <input id="a-name" name="name" required className={adminInput} />
              <FieldError state={state} name="name" />
            </div>
            <div>
              <Label htmlFor="a-role">Role</Label>
              <select id="a-role" name="role" className={adminInput}>
                <option value="fulfillment">Fulfillment</option>
                <option value="support">Support</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </select>
            </div>
          </div>

          <SubmitButton>Grant admin access</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function UpdateAdminUserForm({
  adminUserId,
  role,
  status,
  isSelf,
}: {
  adminUserId: string;
  role: string;
  status: string;
  isSelf: boolean;
}) {
  return (
    <ActionForm action={updateAdminUserAction} className="flex flex-wrap items-center gap-2">
      {() => (
        <>
          <input type="hidden" name="adminUserId" value={adminUserId} />
          <select
            name="role"
            defaultValue={role}
            disabled={isSelf}
            aria-label="Role"
            className={`${adminInput} w-auto py-1.5 text-[13px]`}
          >
            <option value="fulfillment">Fulfillment</option>
            <option value="support">Support</option>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
          </select>
          <select
            name="status"
            defaultValue={status}
            disabled={isSelf}
            aria-label="Status"
            className={`${adminInput} w-auto py-1.5 text-[13px]`}
          >
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
          {isSelf ? (
            <span className="text-[12.5px] font-semibold text-ink-faint">
              You cannot change your own access
            </span>
          ) : (
            <SubmitButton className={adminButtonGhost} pendingLabel="…">
              Save
            </SubmitButton>
          )}
        </>
      )}
    </ActionForm>
  );
}
