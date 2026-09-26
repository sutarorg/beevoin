"use client";

import { useActionState, useState } from "react";
import type { OrderStatus } from "@/db/schema";
import { STATUS_META } from "@/lib/order-status";
import { formatINR } from "@/lib/format";
import {
  createRefundAction,
  updateFulfillmentAction,
  updateOrderStatusAction,
} from "@/app/admin/actions";
import { EMPTY_STATE, type ActionState } from "@/app/admin/action-state";
import { AdminField, FormMessage, SubmitButton, adminInput } from "./forms";

/* ---------- Status ---------- */

export function StatusForm({
  orderId,
  status,
  options,
  courierName,
  trackingId,
}: {
  orderId: string;
  status: OrderStatus;
  options: OrderStatus[];
  courierName: string | null;
  trackingId: string | null;
}) {
  const [state, action] = useActionState(updateOrderStatusAction, EMPTY_STATE);
  const [next, setNext] = useState<OrderStatus | "">(options[0] ?? "");

  if (options.length === 0) {
    return (
      <p className="px-5 py-4 text-[13px] font-semibold text-ink-faint">
        “{STATUS_META[status].label}” is a final state — no further status
        changes are possible.
      </p>
    );
  }

  const needsCourier = next === "shipped" || next === "out_for_delivery";

  return (
    <form action={action} className="space-y-3.5 px-5 py-4">
      <input type="hidden" name="orderId" value={orderId} />
      <AdminField label="Move to" htmlFor="status">
        <select
          id="status"
          name="status"
          value={next}
          onChange={(e) => setNext(e.target.value as OrderStatus)}
          className={adminInput}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {STATUS_META[option].label}
            </option>
          ))}
        </select>
      </AdminField>

      {needsCourier ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <AdminField label="Courier" htmlFor="courierName">
            <input
              id="courierName"
              name="courierName"
              defaultValue={courierName ?? ""}
              placeholder="Delhivery"
              className={adminInput}
            />
          </AdminField>
          <AdminField label="Tracking ID" htmlFor="trackingId">
            <input
              id="trackingId"
              name="trackingId"
              defaultValue={trackingId ?? ""}
              placeholder="AWB number"
              className={adminInput}
            />
          </AdminField>
        </div>
      ) : null}

      <AdminField
        label="Internal note"
        htmlFor="note"
        hint="Saved to the order timeline. Customers never see it."
      >
        <input
          id="note"
          name="note"
          placeholder="Optional"
          className={adminInput}
        />
      </AdminField>

      <FormMessage state={state} />
      <SubmitButton>Update status</SubmitButton>
      <p className="text-[12px] font-semibold text-ink-faint">
        The customer is emailed automatically when the new status has a
        notification template.
      </p>
    </form>
  );
}

/* ---------- Courier details ---------- */

export function FulfillmentForm({
  orderId,
  courierName,
  trackingId,
}: {
  orderId: string;
  courierName: string | null;
  trackingId: string | null;
}) {
  const [state, action] = useActionState(updateFulfillmentAction, EMPTY_STATE);

  return (
    <form action={action} className="space-y-3.5 px-5 py-4">
      <input type="hidden" name="orderId" value={orderId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <AdminField label="Courier" htmlFor="f-courier">
          <input
            id="f-courier"
            name="courierName"
            defaultValue={courierName ?? ""}
            className={adminInput}
          />
        </AdminField>
        <AdminField label="Tracking ID" htmlFor="f-tracking">
          <input
            id="f-tracking"
            name="trackingId"
            defaultValue={trackingId ?? ""}
            className={adminInput}
          />
        </AdminField>
      </div>
      <FormMessage state={state} />
      <SubmitButton variant="secondary">Save courier details</SubmitButton>
    </form>
  );
}

/* ---------- Refund ---------- */

export function RefundForm({
  orderId,
  refundableInPaise,
  delivered,
}: {
  orderId: string;
  refundableInPaise: number;
  delivered: boolean;
}) {
  const [state, action] = useActionState(createRefundAction, EMPTY_STATE);
  // A fresh key per attempt: re-submitting the same rendered form (double
  // click, refresh) reuses the key and can never refund twice.
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [handled, setHandled] = useState<ActionState | null>(null);

  // After a successful refund, roll the key forward so a *deliberate* second
  // refund is possible while an accidental re-submit of the same form is not.
  if (state.ok && handled !== state) {
    setHandled(state);
    setKey(crypto.randomUUID());
  }

  return (
    <form action={action} className="space-y-3.5 px-5 py-4">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="idempotencyKey" value={key} />
      <AdminField
        label="Amount (₹)"
        htmlFor="r-amount"
        hint={`Refundable balance: ${formatINR(refundableInPaise)}`}
      >
        <input
          id="r-amount"
          name="amount"
          inputMode="decimal"
          defaultValue={(refundableInPaise / 100).toFixed(2)}
          className={adminInput}
        />
      </AdminField>
      <AdminField label="Reason" htmlFor="r-reason">
        <input
          id="r-reason"
          name="reason"
          required
          minLength={4}
          placeholder="Customer cancelled before dispatch"
          className={adminInput}
        />
      </AdminField>
      <label className="flex items-center gap-2 text-[13px] font-bold text-ink">
        <input
          type="checkbox"
          name="restock"
          defaultChecked={!delivered}
          className="size-4 accent-[#1D1912]"
        />
        Return the units to stock
      </label>
      <FormMessage state={state} />
      <SubmitButton variant="danger">Issue refund</SubmitButton>
      <p className="text-[12px] font-semibold text-ink-faint">
        Refunds are sent to Razorpay immediately and usually reach the customer
        in 5–7 working days.
      </p>
    </form>
  );
}
