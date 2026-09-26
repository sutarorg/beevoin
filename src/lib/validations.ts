import { z } from "zod";

/**
 * Every server input is validated here. Client forms reuse the same schemas,
 * but the server parse is the one that counts.
 *
 * Commercial limits (max per order) come from the product row at request
 * time, so the schema only enforces a sane absolute ceiling.
 */

export const ABSOLUTE_MAX_QUANTITY = 20;

export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
] as const;

export const phoneRegex = /^[6-9]\d{9}$/;
export const pincodeRegex = /^[1-9]\d{5}$/;
export const orderNumberRegex = /^BV-\d{6}-\d{4}$/i;

const messages = {
  phone: "Enter a valid 10-digit Indian mobile number",
  pincode: "Enter a valid 6-digit PIN code",
};

export const checkoutSchema = z.object({
  name: z
    .string({ error: "Please enter your full name" })
    .trim()
    .min(2, "Please enter your full name")
    .max(80, "Name is too long"),
  email: z
    .string({ error: "Enter a valid email address" })
    .trim()
    .email("Enter a valid email address")
    .max(160),
  phone: z.string({ error: messages.phone }).trim().regex(phoneRegex, messages.phone),
  addressLine1: z
    .string({ error: "Enter your house/flat number and street" })
    .trim()
    .min(4, "Enter your house/flat number and street")
    .max(140),
  addressLine2: z.string().trim().max(140).optional().or(z.literal("")),
  locality: z
    .string({ error: "Enter your area or locality" })
    .trim()
    .min(2, "Enter your area or locality")
    .max(100),
  city: z
    .string({ error: "Enter your city" })
    .trim()
    .min(2, "Enter your city")
    .max(80),
  state: z.enum(INDIAN_STATES, {
    message: "Select your state",
  }),
  pincode: z
    .string({ error: messages.pincode })
    .trim()
    .regex(pincodeRegex, messages.pincode),
  quantity: z
    .number()
    .int()
    .min(1, "Quantity must be at least 1")
    .max(ABSOLUTE_MAX_QUANTITY, "That quantity isn't available"),
  paymentMethod: z.enum(["cod", "online"]),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const trackSchema = z
  .object({
    orderNumber: z
      .string()
      .trim()
      .regex(orderNumberRegex, "Enter a valid order ID, e.g. BV-260203-4821"),
    phone: z.string().trim().optional().or(z.literal("")),
    email: z.string().trim().optional().or(z.literal("")),
    lookupSecret: z.string().trim().optional().or(z.literal("")),
  })
  .refine(
    (v) =>
      (v.phone && phoneRegex.test(v.phone)) ||
      (v.email && z.string().email().safeParse(v.email).success) ||
      (v.lookupSecret && v.lookupSecret.length >= 16),
    {
      message:
        "Enter the mobile number or email used while ordering to verify it's you",
      path: ["phone"],
    },
  );
export type TrackInput = z.infer<typeof trackSchema>;

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(100),
  email: z.string().trim().email("Enter a valid email address").max(160),
  phone: z
    .string()
    .trim()
    .regex(phoneRegex, messages.phone)
    .optional()
    .or(z.literal("")),
  topic: z
    .enum(["general", "order", "shipping", "returns", "product"])
    .default("general"),
  orderNumber: z
    .string()
    .trim()
    .regex(orderNumberRegex, "Order IDs look like BV-260203-4821")
    .optional()
    .or(z.literal("")),
  message: z
    .string()
    .trim()
    .min(10, "Please add a few more details (min. 10 characters)")
    .max(1500),
});
export type ContactInput = z.infer<typeof contactSchema>;

/* -------------------------------------------------------------------------
 * Admin inputs (Supabase Auth + authorised mutations)
 * ---------------------------------------------------------------------- */

export const adminLoginSchema = z.object({
  email: z.string().trim().email("Enter your admin email address").max(160),
  password: z.string().min(8, "Enter your password"),
});
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export const orderStatusValues = [
  "pending",
  "payment_pending",
  "confirmed",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "refunded",
] as const;

export const adminStatusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(orderStatusValues),
  courierName: z.string().trim().max(80).optional().or(z.literal("")),
  trackingId: z.string().trim().max(80).optional().or(z.literal("")),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});
export type AdminStatusInput = z.infer<typeof adminStatusSchema>;

export const adminFulfillmentSchema = z.object({
  orderId: z.string().uuid(),
  courierName: z.string().trim().max(80).optional().or(z.literal("")),
  trackingId: z.string().trim().max(80).optional().or(z.literal("")),
});

export const adminRefundSchema = z.object({
  orderId: z.string().uuid(),
  amountInPaise: z
    .number()
    .int("Refund amounts are whole paise")
    .positive("Enter an amount greater than zero")
    .max(100_000_00, "Refund amount looks too large"),
  reason: z
    .string()
    .trim()
    .min(4, "Give a short reason for the refund")
    .max(300),
  restock: z.boolean().optional(),
  idempotencyKey: z.string().trim().min(8).max(160),
});

export const productUpdateSchema = z.object({
  productId: z.string().uuid(),
  name: z.string().trim().min(3).max(140),
  shortName: z.string().trim().min(2).max(60),
  sku: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Za-z0-9-_]+$/, "SKU can use letters, numbers, - and _ only"),
  shortDescription: z.string().trim().max(320).optional().or(z.literal("")),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  priceInPaise: z
    .number()
    .int("Prices are whole paise")
    .min(100, "Price must be at least ₹1")
    .max(100_000_00, "Price looks too large"),
  shippingInPaise: z
    .number()
    .int("Shipping is whole paise")
    .min(0)
    .max(50_000_00),
  maxPerOrder: z.number().int().min(1).max(20),
  lowStockThreshold: z.number().int().min(0).max(10_000),
  active: z.boolean(),
  seoTitle: z.string().trim().max(160).optional().or(z.literal("")),
  seoDescription: z.string().trim().max(320).optional().or(z.literal("")),
});

export const inventoryAdjustSchema = z.object({
  productId: z.string().uuid(),
  mode: z.enum(["restock", "manual_adjustment", "set"]),
  quantity: z.number().int().min(-10_000).max(10_000),
  note: z.string().trim().min(3, "Say why stock is changing").max(300),
});

export const adminUserSchema = z.object({
  supabaseUserId: z.string().uuid("Paste the Supabase user UUID"),
  email: z.string().trim().email("Enter a valid email").max(160),
  name: z.string().trim().max(100).optional().or(z.literal("")),
  role: z.enum(["owner", "admin", "support", "fulfillment"]),
});

export const adminUserUpdateSchema = z.object({
  adminUserId: z.string().uuid(),
  role: z.enum(["owner", "admin", "support", "fulfillment"]),
  status: z.enum(["active", "suspended"]),
});

export const settingsSchema = z.object({
  storeName: z.string().trim().min(2).max(80),
  supportEmail: z.string().trim().email().max(160),
  legalName: z.string().trim().min(2).max(140),
  businessAddress: z.string().trim().max(300).optional().or(z.literal("")),
  supportHours: z.string().trim().max(120),
  adminNotificationEmail: z
    .string()
    .trim()
    .email("Enter a valid notification email")
    .max(160)
    .optional()
    .or(z.literal("")),
  dispatchWindow: z.string().trim().max(120),
  deliveryEstimate: z.string().trim().max(160),
  replacementWindowDays: z.number().int().min(0).max(365),
});

export const messageUpdateSchema = z.object({
  messageId: z.string().uuid(),
  status: z.enum(["new", "read", "resolved"]),
  adminNote: z.string().trim().max(500).optional().or(z.literal("")),
});

export const emailRetrySchema = z.object({
  emailLogId: z.string().uuid(),
});
