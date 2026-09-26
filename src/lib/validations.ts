import { z } from "zod";
import { product } from "./config";

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
  quantity: z
    .number()
    .int()
    .min(1, "Quantity must be at least 1")
    .max(product.maxPerOrder, `Maximum ${product.maxPerOrder} units per order`),
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

export const adminLoginSchema = z.object({
  password: z.string().min(1, "Enter the admin password"),
});

export const adminStatusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum([
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "out_for_delivery",
    "delivered",
    "cancelled",
    "refunded",
  ]),
  courierName: z.string().trim().max(80).optional().or(z.literal("")),
  trackingId: z.string().trim().max(80).optional().or(z.literal("")),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});
export type AdminStatusInput = z.infer<typeof adminStatusSchema>;
