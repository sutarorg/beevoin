import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailLogs, storeSettings } from "@/db/schema";
import {
  createTestProduct,
  hasDatabase,
  resetDatabase,
  uniqueCustomer,
} from "./helpers";

// Pretend Resend is configured; the SDK itself is mocked so nothing leaves
// the machine. Env must be set before the modules that read it are imported.
process.env.RESEND_API_KEY = "re_test_key";
process.env.RESEND_FROM_EMAIL = "orders@example.com";
process.env.RESEND_FROM_NAME = "Beevo";
process.env.ADMIN_NOTIFICATION_EMAIL = "ops@example.com";

const sent: Array<{ to: string[]; subject: string; html: string }> = [];
let resendFails = false;

vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (payload: { to: string[]; subject: string; html: string }) => {
        if (resendFails) {
          return { data: null, error: { name: "api_error", message: "Service down" } };
        }
        sent.push(payload);
        return { data: { id: `msg_${sent.length}` }, error: null };
      },
    };
  },
}));

const { sendOrderEmail, sendStatusEmail, sendAdminNewOrderEmail } = await import(
  "@/lib/email/send"
);
const { createOrder, transitionOrder } = await import("@/lib/orders");

const suite = hasDatabase ? describe : describe.skip;

suite("transactional email", () => {
  beforeEach(async () => {
    await resetDatabase();
    sent.length = 0;
    resendFails = false;
    await db
      .insert(storeSettings)
      .values({ key: "adminNotificationEmail", value: "ops@example.com" })
      .onConflictDoNothing();
  });

  async function makeOrder(seed: number, paymentMethod: "cod" | "online" = "cod") {
    const product = await createTestProduct({ inventoryQuantity: 10 });
    const { order } = await createOrder({
      customer: uniqueCustomer(seed),
      quantity: 1,
      paymentMethod,
      product,
    });
    return order;
  }

  it("sends an order email once, no matter how often it is triggered", async () => {
    const order = await makeOrder(41);

    const first = await sendOrderEmail(order, "order_confirmed");
    const second = await sendOrderEmail(order, "order_confirmed");

    expect(first).toEqual({ sent: true, duplicate: false });
    expect(second).toEqual({ sent: false, duplicate: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toEqual([order.email]);
    expect(sent[0].subject).toContain(order.orderNumber);

    const logs = await db
      .select()
      .from(emailLogs)
      .where(eq(emailLogs.orderId, order.id));
    expect(logs).toHaveLength(1);
    expect(logs[0].delivery).toBe("sent");
    expect(logs[0].providerMessageId).toBe("msg_1");
  });

  it("keeps one email per status, so a re-run of a transition is silent", async () => {
    const order = await makeOrder(42);
    const shipped = { ...order, status: "shipped" as const };

    await sendStatusEmail(shipped, { idempotencyKey: `${order.id}:status:shipped` });
    await sendStatusEmail(shipped, { idempotencyKey: `${order.id}:status:shipped` });

    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain("has shipped");
  });

  it("records a provider failure without throwing", async () => {
    const order = await makeOrder(43);
    resendFails = true;

    const result = await sendOrderEmail(order, "order_confirmed");
    expect(result).toEqual({ sent: false, duplicate: false });

    const [log] = await db
      .select()
      .from(emailLogs)
      .where(eq(emailLogs.orderId, order.id));
    expect(log.delivery).toBe("failed");
    expect(log.error).toContain("Service down");
    expect(log.attempts).toBe(1);
  });

  it("never lets an email failure break an order transition", async () => {
    const order = await makeOrder(44);
    resendFails = true;

    await expect(
      transitionOrder({
        orderId: order.id,
        to: "confirmed",
        actor: { type: "system", label: "test" },
      }),
    ).resolves.toMatchObject({ changed: true });
  });

  it("notifies the shop owner once per order", async () => {
    const order = await makeOrder(45, "online");

    await sendAdminNewOrderEmail(order);
    await sendAdminNewOrderEmail(order);

    const adminMails = sent.filter((m) => m.to[0] === "ops@example.com");
    expect(adminMails).toHaveLength(1);
  });

  it("stores the payload but not the rendered customer HTML", async () => {
    const order = await makeOrder(46);
    await sendOrderEmail(order, "order_confirmed");

    const [log] = await db
      .select()
      .from(emailLogs)
      .where(eq(emailLogs.orderId, order.id));
    expect(log.html).toBeNull();
    expect(log.payload).toMatchObject({ orderId: order.id, template: "order_confirmed" });
  });
});
