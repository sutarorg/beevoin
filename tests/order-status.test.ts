import { describe, expect, it } from "vitest";
import {
  allowedNextStatuses,
  canTransition,
  isOpenOrder,
  ORDER_STATUSES,
  STATUS_META,
  STATUS_TRANSITIONS,
} from "@/lib/order-status";
import { ROLE_PERMISSIONS, roleHasPermission } from "@/lib/auth/permissions";

describe("order status machine", () => {
  it("describes every status", () => {
    for (const status of ORDER_STATUSES) {
      expect(STATUS_META[status]?.label).toBeTruthy();
    }
  });

  it("allows the happy path end to end", () => {
    const path = [
      "pending",
      "payment_pending",
      "confirmed",
      "processing",
      "shipped",
      "out_for_delivery",
      "delivered",
    ] as const;

    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i], path[i + 1])).toBe(true);
    }
  });

  it("refuses to move backwards or skip fulfilment", () => {
    expect(canTransition("delivered", "shipped")).toBe(false);
    expect(canTransition("pending", "delivered")).toBe(false);
    expect(canTransition("confirmed", "shipped")).toBe(false);
    expect(canTransition("cancelled", "confirmed")).toBe(false);
  });

  it("treats a same-status move as not a transition", () => {
    for (const status of ORDER_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it("has no exits from refunded", () => {
    expect(allowedNextStatuses("refunded")).toHaveLength(0);
  });

  it("only allows refunding from states where money could exist", () => {
    for (const [from, targets] of Object.entries(STATUS_TRANSITIONS)) {
      if (!targets.includes("refunded")) continue;
      expect(["confirmed", "processing", "shipped", "out_for_delivery", "delivered", "cancelled"]).toContain(from);
    }
  });

  it("closes finished orders", () => {
    expect(isOpenOrder("delivered")).toBe(false);
    expect(isOpenOrder("cancelled")).toBe(false);
    expect(isOpenOrder("refunded")).toBe(false);
    expect(isOpenOrder("processing")).toBe(true);
  });
});

describe("permission matrix", () => {
  it("gives the owner everything", () => {
    expect(roleHasPermission("owner", "settings.update")).toBe(true);
    expect(roleHasPermission("owner", "admins.manage")).toBe(true);
    expect(roleHasPermission("owner", "refunds.create")).toBe(true);
  });

  it("keeps store settings and admin management away from admins", () => {
    expect(roleHasPermission("admin", "settings.update")).toBe(false);
    expect(roleHasPermission("admin", "admins.manage")).toBe(false);
    expect(roleHasPermission("admin", "refunds.create")).toBe(true);
  });

  it("makes support read-only where money is involved", () => {
    expect(roleHasPermission("support", "orders.view")).toBe(true);
    expect(roleHasPermission("support", "messages.resolve")).toBe(true);
    expect(roleHasPermission("support", "refunds.create")).toBe(false);
    expect(roleHasPermission("support", "orders.update_status")).toBe(false);
    expect(roleHasPermission("support", "inventory.adjust")).toBe(false);
  });

  it("limits fulfilment to shipping work", () => {
    expect(roleHasPermission("fulfillment", "orders.update_fulfillment")).toBe(true);
    expect(roleHasPermission("fulfillment", "inventory.adjust")).toBe(true);
    expect(roleHasPermission("fulfillment", "payments.view")).toBe(false);
    expect(roleHasPermission("fulfillment", "refunds.create")).toBe(false);
    expect(roleHasPermission("fulfillment", "customers.view")).toBe(false);
  });

  it("never grants a permission that doesn't exist", () => {
    const known = new Set(ROLE_PERMISSIONS.owner);
    for (const role of ["admin", "support", "fulfillment"] as const) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(known.has(permission)).toBe(true);
      }
    }
  });
});
