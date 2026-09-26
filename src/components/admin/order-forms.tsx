"use client";

import { useState } from "react";
import {
  updateFulfillmentAction,
  updateOrderStatusAction,
  createRefundAction,
} from "@/app/admin/actions";
import { ActionForm, SubmitButton } from "./form";
import { adminInput, adminButtonDanger, Notice } from "./ui";

/**
 * Client forms for the order detail page.
 *
 * They render options and collect input; they decide nothing. The allowed
 * next statuses are computed on the server from the state machine, and the
 * server action re-validates both the transition and the admin's permission
 * before anything is written.
 */

function Label({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-[11.5px] font-extrabold uppercase tracking-wider text-ink-faint"
    >
      {children}
    </label>
  );
}

export function OrderStatusForm({
  orderId,
  options,
  requiresTracking,
}: {
  orderId: string;
  options: { value: string; label: string }[];
  requiresTracking: boolean;
}) {
  if (options.length === 0) {
    return (
      <div className="px-5 py-4">
        <Notice>
          This order is in a terminal state — no further status change is
          possible.
        </Notice>
      </div>
    );
  }

  return (
    <ActionForm action={updateOrderStatusAction} className="space-y-3 px-5 py-4">
      {() => (
        <>
          <input type="hidden" name="orderId" value={orderId} />
          <div>
            <Label htmlFor="status">Move to</Label>
            <select id="status" name="status" required className={adminInput}>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {requiresTracking ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="courierName">Courier</Label>
                <input
                  id="courierName"
                  name="courierName"
                  maxLength={80}
                  placeholder="Delhivery"
                  className={adminInput}
                />
              </div>
              <div>
                <Label htmlFor="trackingId">Tracking ID</Label>
                <input
                  id="trackingId"
                  name="trackingId"
                  maxLength={80}
                  placeholder="1234567890"
                  className={adminInput}
                />
              </div>
            </div>
          ) : null}

          <div>
            <Label htmlFor="note">Internal note (optional)</Label>
            <input
              id="note"
              name="note"
              maxLength={300}
              placeholder="Why is this changing?"
              className={adminInput}
            />
          </div>

          <SubmitButton pendingLabel="Updating…">Update status</SubmitButton>
          <p className="text-[12.5px] text-ink-soft">
            The customer is emailed automatically for customer-visible statuses.
          </p>
        </>
      )}
    </ActionForm>
  );
}

export function FulfillmentForm({
  orderId,
  courierName,
  trackingId,
}: {
  orderId: string;
  courierName: string | null;
  trackingId: string | null;
}) {
  return (
    <ActionForm action={updateFulfillmentAction} className="space-y-3 px-5 py-4">
      {() => (
        <>
          <input type="hidden" name="orderId" value={orderId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="f-courier">Courier</Label>
              <input
                id="f-courier"
                name="courierName"
                defaultValue={courierName ?? ""}
                maxLength={80}
                className={adminInput}
              />
            </div>
            <div>
              <Label htmlFor="f-tracking">Tracking ID</Label>
              <input
                id="f-tracking"
                name="trackingId"
                defaultValue={trackingId ?? ""}
                maxLength={80}
                className={adminInput}
              />
            </div>
          </div>
          <SubmitButton>Save tracking</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function RefundForm({
  orderId,
  refundableInPaise,
  alreadyRefundedInPaise,
}: {
  orderId: string;
  refundableInPaise: number;
  alreadyRefundedInPaise: number;
}) {
  const maxRupees = refundableInPaise / 100;
  const [amount, setAmount] = useState(maxRupees.toFixed(2));

  return (
    <ActionForm action={createRefundAction} className="space-y-3 px-5 py-4">
      {() => (
        <>
          <input type="hidden" name="orderId" value={orderId} />

          <Notice tone="warning">
            Refunds are sent to Razorpay immediately and cannot be undone. Up to{" "}
            <strong>₹{maxRupees.toFixed(2)}</strong> can be refunded
            {alreadyRefundedInPaise > 0
              ? ` (₹${(alreadyRefundedInPaise / 100).toFixed(2)} already refunded).`
              : "."}
          </Notice>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="amountInRupees">Amount (₹)</Label>
              <input
                id="amountInRupees"
                name="amountInRupees"
                type="number"
                step="0.01"
                min="1"
                max={maxRupees}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
                className={adminInput}
              />
              <button
                type="button"
                onClick={() => setAmount(maxRupees.toFixed(2))}
                className="mt-1 text-[12px] font-bold text-accent-deep underline-offset-2 hover:underline"
              >
                Refund the full remaining amount
              </button>
            </div>
            <div>
              <Label htmlFor="refund-reason">Reason (audit-logged)</Label>
              <input
                id="refund-reason"
                name="reason"
                required
                minLength={3}
                maxLength={300}
                placeholder="Damaged on arrival"
                className={adminInput}
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-[13.5px] font-semibold text-ink">
            <input
              type="checkbox"
              name="restock"
              className="size-4 accent-[#1d1912]"
            />
            Return these units to inventory
          </label>

          <label className="flex items-center gap-2.5 text-[13.5px] font-bold text-chili">
            <input
              type="checkbox"
              name="confirm"
              required
              className="size-4 accent-[#c63b2f]"
            />
            I understand this refund is final.
          </label>

          <SubmitButton
            className={adminButtonDanger}
            pendingLabel="Sending to Razorpay…"
            confirm="Send this refund to Razorpay now? This cannot be undone."
          >
            Issue refund
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
