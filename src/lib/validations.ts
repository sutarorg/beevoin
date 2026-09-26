import { z } from "zod";

/**
 * Every server-accepted input is validated here with Zod. Client components
 * reuse the same schemas so the browser and the server agree on the rules —
 * but the server check is the authoritative one.
 *
 * This module is intentionally free of server-only imports so it can be used
 * inside client components.
 */

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

const checkoutBase = {
  name: z
    .string()
    .trim()
    .min(2, "Please enter your full name")
    .max(80, "Name is too long"),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(160),
  phone: z.string().trim().regex(phoneRegex, messages.phone),
  addressLine1: z
    .string()
    .trim()
    .min(4, "Enter your house/flat number and street")
    .max(140),
  addressLine2: z.string().trim().max(140).optional().or(z.literal("")),
  locality: z.string().trim().min(2, "Enter your area or locality").max(100),
  city: z.string().trim().min(2, "Enter your city").max(80),
  state: z.enum(INDIAN_STATES, {
    message: "Select your state",
  }),
  pincode: z.string().trim().regex(pincodeRegex, messages.pincode),
  paymentMethod: z.enum(["cod", "online"]),
  /** Signed one-time token issued only after the server verifies the SMS OTP. */
  codOtpToken: z.string().trim().max(1000).optional(),
};

/**
 * Checkout schema. `maxPerOrder` comes from the authoritative product row, so
 * the limit can be changed from /admin without a deploy.
 */
export function buildCheckoutSchema(maxPerOrder: number) {
  return z.object({
    ...checkoutBase,
    quantity: z
      .number()
      .int()
      .min(1, "Quantity must be at least 1")
      .max(maxPerOrder, `Maximum ${maxPerOrder} units per order`),
  });
}

export type CheckoutInput = z.infer<ReturnType<typeof buildCheckoutSchema>>;

export const codOtpSendSchema = z.object({
  phone: z.string().trim().regex(phoneRegex, messages.phone),
});

export const codOtpVerifySchema = z.object({
  phone: z.string().trim().regex(phoneRegex, messages.phone),
  code: z.string().trim().regex(/^\d{4,10}$/, "Enter the OTP sent to your mobile number"),
});

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
    .enum(["general", "order", "shipping", "replacement", "product"])
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

/* ------------------------------------------------------------------ *
 * Admin inputs. Every admin mutation validates through one of these.
 * ------------------------------------------------------------------ */

export const adminLoginSchema = z.object({
  email: z.string().trim().email("Enter your admin email address").max(160),
  password: z.string().min(8, "Enter your password"),
});
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export const ORDER_STATUS_VALUES = [
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
  status: z.enum(ORDER_STATUS_VALUES),
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

export const productUpdateSchema = z.object({
  name: z.string().trim().min(2).max(140),
  shortName: z.string().trim().min(2).max(60),
  sku: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Za-z0-9-]+$/, "SKU may contain letters, numbers and hyphens"),
  shortDescription: z.string().trim().max(300),
  description: z.string().trim().max(5000),
  active: z.boolean(),
  maxPerOrder: z.number().int().min(1).max(20),
  lowStockThreshold: z.number().int().min(0).max(10_000),
  metaTitle: z.string().trim().max(160).optional().or(z.literal("")),
  metaDescription: z.string().trim().max(320).optional().or(z.literal("")),
  specifications: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(60),
        value: z.string().trim().min(1).max(200),
      }),
    )
    .max(20),
  images: z
    .array(
      z.object({
        src: z
          .string()
          .trim()
          .min(1)
          .max(300)
          .regex(
            /^\/[A-Za-z0-9._\/-]+$/,
            "Image paths must be local, e.g. /images/product-1.jpg",
          ),
        alt: z.string().trim().min(1).max(200),
      }),
    )
    .max(12),
});
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

/** Prices are integer paise, always. ₹999 === 99900. */
export const priceUpdateSchema = z.object({
  priceInPaise: z
    .number()
    .int("Online price must be a whole number of paise")
    .min(100, "Online price must be at least ₹1")
    .max(10_000_000, "Online price looks wrong — check the paise value"),
  codPriceInPaise: z
    .number()
    .int("COD price must be a whole number of paise")
    .min(100, "COD price must be at least ₹1")
    .max(10_000_000, "COD price looks wrong — check the paise value"),
  shippingInPaise: z
    .number()
    .int("Shipping must be a whole number of paise")
    .min(0)
    .max(1_000_000),
});

export const inventoryAdjustSchema = z.object({
  delta: z
    .number()
    .int("Enter a whole number of units")
    .refine((v) => v !== 0, "Enter a non-zero adjustment")
    .min(-100_000)
    .max(100_000),
  reason: z.enum(["restock", "manual_adjustment", "initial_stock"]),
  note: z
    .string()
    .trim()
    .min(3, "Explain why stock is changing")
    .max(300),
});

export const refundRequestSchema = z.object({
  orderId: z.string().uuid(),
  amountInPaise: z
    .number()
    .int("Refund amount must be a whole number of paise")
    .min(100, "Refund must be at least ₹1"),
  reason: z.string().trim().min(3, "A refund reason is required").max(300),
  restock: z.boolean(),
  confirm: z.literal(true, { message: "Please confirm the refund" }),
});

export const emailRetrySchema = z.object({
  emailLogId: z.string().uuid(),
});

export const contactResolveSchema = z.object({
  messageId: z.string().uuid(),
  status: z.enum(["new", "read", "resolved"]),
});

export const settingsUpdateSchema = z.object({
  store_name: z.string().trim().min(1).max(80),
  support_email: z.string().trim().email().max(160),
  legal_name: z.string().trim().min(1).max(120),
  business_address: z.string().trim().max(300),
  support_hours: z.string().trim().max(120),
  admin_notification_email: z.string().trim().email().max(160),
  dispatch_window: z.string().trim().max(120),
  delivery_estimate: z.string().trim().max(120),
  replacement_window_days: z.coerce.number().int().min(0).max(90),
});

export const adminUserCreateSchema = z.object({
  supabaseUserId: z.string().uuid("Paste the Supabase user UUID"),
  email: z.string().trim().email().max(160),
  name: z.string().trim().min(2).max(100),
  role: z.enum(["owner", "admin", "support", "fulfillment"]),
});

export const adminUserUpdateSchema = z.object({
  adminUserId: z.string().uuid(),
  role: z.enum(["owner", "admin", "support", "fulfillment"]),
  status: z.enum(["active", "suspended"]),
});
