"use client";

import { useActionState, useState } from "react";
import type { Product } from "@/db/schema";
import { adjustInventoryAction, updateProductAction } from "@/app/admin/actions";
import { EMPTY_STATE } from "@/app/admin/action-state";
import { AdminField, FormMessage, SubmitButton, adminInput } from "./forms";

export function ProductForm({
  product,
  canEditPrice,
}: {
  product: Product;
  canEditPrice: boolean;
}) {
  const [state, action] = useActionState(updateProductAction, EMPTY_STATE);
  const metadata = (product.metadata ?? {}) as Record<string, unknown>;

  return (
    <form action={action} className="space-y-4 px-5 py-5">
      <input type="hidden" name="productId" value={product.id} />

      <div className="grid gap-3 sm:grid-cols-2">
        <AdminField label="Product name" htmlFor="p-name">
          <input
            id="p-name"
            name="name"
            defaultValue={product.name}
            required
            className={adminInput}
          />
        </AdminField>
        <AdminField label="Short name" htmlFor="p-short">
          <input
            id="p-short"
            name="shortName"
            defaultValue={product.shortName}
            required
            className={adminInput}
          />
        </AdminField>
        <AdminField label="SKU" htmlFor="p-sku">
          <input
            id="p-sku"
            name="sku"
            defaultValue={product.sku}
            required
            className={adminInput}
          />
        </AdminField>
        <AdminField
          label="Price (₹)"
          htmlFor="p-price"
          hint={
            canEditPrice
              ? "Applies to new orders only — existing orders keep their snapshot."
              : "Your role cannot change pricing."
          }
        >
          <input
            id="p-price"
            name="price"
            inputMode="decimal"
            defaultValue={(product.priceInPaise / 100).toFixed(2)}
            readOnly={!canEditPrice}
            className={adminInput}
          />
        </AdminField>
        <AdminField label="Shipping (₹)" htmlFor="p-shipping">
          <input
            id="p-shipping"
            name="shipping"
            inputMode="decimal"
            defaultValue={(product.shippingInPaise / 100).toFixed(2)}
            readOnly={!canEditPrice}
            className={adminInput}
          />
        </AdminField>
        <AdminField label="Max per order" htmlFor="p-max">
          <input
            id="p-max"
            name="maxPerOrder"
            type="number"
            min={1}
            max={20}
            defaultValue={product.maxPerOrder}
            className={adminInput}
          />
        </AdminField>
        <AdminField
          label="Low-stock alert at"
          htmlFor="p-low"
          hint="An email goes to the notification address at or below this level."
        >
          <input
            id="p-low"
            name="lowStockThreshold"
            type="number"
            min={0}
            defaultValue={product.lowStockThreshold}
            className={adminInput}
          />
        </AdminField>
        <AdminField label="Storefront status" htmlFor="p-active">
          <select
            id="p-active"
            name="active"
            defaultValue={product.active ? "true" : "false"}
            className={adminInput}
          >
            <option value="true">Active — on sale</option>
            <option value="false">Inactive — hidden from checkout</option>
          </select>
        </AdminField>
      </div>

      <AdminField label="Short description" htmlFor="p-shortdesc">
        <input
          id="p-shortdesc"
          name="shortDescription"
          defaultValue={product.shortDescription ?? ""}
          className={adminInput}
        />
      </AdminField>

      <AdminField label="Description" htmlFor="p-desc">
        <textarea
          id="p-desc"
          name="description"
          rows={4}
          defaultValue={product.description ?? ""}
          className={`${adminInput} min-h-24 py-2.5`}
        />
      </AdminField>

      <div className="grid gap-3 sm:grid-cols-2">
        <AdminField label="SEO title" htmlFor="p-seotitle">
          <input
            id="p-seotitle"
            name="seoTitle"
            defaultValue={String(metadata.seoTitle ?? "")}
            className={adminInput}
          />
        </AdminField>
        <AdminField label="SEO description" htmlFor="p-seodesc">
          <input
            id="p-seodesc"
            name="seoDescription"
            defaultValue={String(metadata.seoDescription ?? "")}
            className={adminInput}
          />
        </AdminField>
      </div>

      <FormMessage state={state} />
      <SubmitButton>Save product</SubmitButton>
    </form>
  );
}

export function InventoryForm({
  productId,
  currentQuantity,
}: {
  productId: string;
  currentQuantity: number;
}) {
  const [state, action] = useActionState(adjustInventoryAction, EMPTY_STATE);
  const [mode, setMode] = useState("restock");

  return (
    <form action={action} className="space-y-3.5 px-5 py-5">
      <input type="hidden" name="productId" value={productId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <AdminField label="Action" htmlFor="i-mode">
          <select
            id="i-mode"
            name="mode"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className={adminInput}
          >
            <option value="restock">Add stock (restock)</option>
            <option value="manual_adjustment">
              Adjust by ± (damage, correction)
            </option>
            <option value="set">Set exact count (stock take)</option>
          </select>
        </AdminField>
        <AdminField
          label={mode === "set" ? "New total" : "Quantity"}
          htmlFor="i-qty"
          hint={`Currently ${currentQuantity} on hand`}
        >
          <input
            id="i-qty"
            name="quantity"
            type="number"
            required
            defaultValue={mode === "set" ? currentQuantity : 1}
            className={adminInput}
          />
        </AdminField>
      </div>
      <AdminField
        label="Reason"
        htmlFor="i-note"
        hint="Recorded in the inventory ledger and the audit log."
      >
        <input
          id="i-note"
          name="note"
          required
          minLength={3}
          placeholder="Received 50 units from supplier"
          className={adminInput}
        />
      </AdminField>
      <FormMessage state={state} />
      <SubmitButton>Apply adjustment</SubmitButton>
    </form>
  );
}
