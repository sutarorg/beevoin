import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, type Db } from "@/db";
import { codPhoneVerifications } from "@/db/schema";

const TOKEN_TTL_MS = 15 * 60 * 1000;

type VerifiedTokenPayload = {
  phone: string;
  expiresAt: number;
  nonce: string;
};

type TwilioVerifyResponse = {
  status?: string;
  message?: string;
  code?: number;
};

/** A safe error to surface from the COD verification flow. */
export class CodPhoneVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodPhoneVerificationError";
  }
}

function config() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() ?? "";
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() ?? "";
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim() ?? "";
  const tokenSecret = process.env.COD_OTP_TOKEN_SECRET?.trim() ?? "";
  return { accountSid, authToken, verifyServiceSid, tokenSecret };
}

/**
 * COD never degrades to an unchecked order. Until all four server-only values
 * are configured, the checkout server rejects COD and the UI marks it
 * unavailable.
 */
export function isCodOtpConfigured(): boolean {
  const { accountSid, authToken, verifyServiceSid, tokenSecret } = config();
  return Boolean(
    accountSid &&
      authToken &&
      verifyServiceSid &&
      tokenSecret.length >= 32,
  );
}

function assertConfigured() {
  if (!isCodOtpConfigured()) {
    throw new CodPhoneVerificationError(
      "Cash on Delivery verification is temporarily unavailable. Please pay online or contact support.",
    );
  }
  return config();
}

function basicAuth(accountSid: string, authToken: string): string {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
}

function asIndianE164(phone: string): string {
  return `+91${phone}`;
}

async function twilioRequest(
  path: string,
  fields: Record<string, string>,
): Promise<TwilioVerifyResponse> {
  const { accountSid, authToken } = assertConfigured();
  const response = await fetch(`https://verify.twilio.com/v2/${path}`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(accountSid, authToken),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(fields),
    cache: "no-store",
  });

  const data = (await response.json().catch(() => ({}))) as TwilioVerifyResponse;
  if (!response.ok) {
    // Provider messages can vary and may contain operational detail. Keep the
    // customer-facing response stable while retaining a useful server error.
    throw new CodPhoneVerificationError(
      data.code === 60200 || data.code === 60203
        ? "We couldn't send a code to that mobile number. Check it and try again."
        : "We couldn't send the verification code. Please try again in a moment.",
    );
  }
  return data;
}

/** Request a Twilio Verify SMS. Twilio owns the code; we never store OTPs. */
export async function sendCodOtp(phone: string): Promise<void> {
  const { verifyServiceSid } = assertConfigured();
  const result = await twilioRequest(
    `Services/${encodeURIComponent(verifyServiceSid)}/Verifications`,
    { To: asIndianE164(phone), Channel: "sms" },
  );
  if (result.status !== "pending") {
    throw new CodPhoneVerificationError(
      "We couldn't start mobile verification. Please try again.",
    );
  }
}

function encode(payload: VerifiedTokenPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Check the code with Twilio and mint a short-lived, signed one-time checkout
 * token. The opaque token—not the OTP—returns to the browser.
 */
export async function verifyCodOtp(phone: string, code: string): Promise<string> {
  const { verifyServiceSid, tokenSecret } = assertConfigured();
  const result = await twilioRequest(
    `Services/${encodeURIComponent(verifyServiceSid)}/VerificationCheck`,
    { To: asIndianE164(phone), Code: code },
  );
  if (result.status !== "approved") {
    throw new CodPhoneVerificationError(
      "That code is incorrect or has expired. Request a new code and try again.",
    );
  }

  const payload: VerifiedTokenPayload = {
    phone,
    expiresAt: Date.now() + TOKEN_TTL_MS,
    nonce: randomBytes(18).toString("base64url"),
  };
  const encodedPayload = encode(payload);
  const token = `${encodedPayload}.${sign(encodedPayload, tokenSecret)}`;

  await db.insert(codPhoneVerifications).values({
    phone,
    tokenHash: hashToken(token),
    expiresAt: new Date(payload.expiresAt),
    verifiedAt: new Date(),
  });

  return token;
}

/**
 * Validate the signed token before a transaction starts. Consumption happens
 * inside `createOrder()` so a verification cannot be replayed and is not lost
 * if the order transaction rolls back.
 */
export function parseCodVerificationToken(
  token: string | undefined,
  phone: string,
): { tokenHash: string } {
  const { tokenSecret } = assertConfigured();
  if (!token) {
    throw new CodPhoneVerificationError(
      "Verify your mobile number with the OTP before placing a COD order.",
    );
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature || token.split(".").length !== 2) {
    throw new CodPhoneVerificationError("Your mobile verification has expired. Please verify again.");
  }

  const expectedSignature = sign(encodedPayload, tokenSecret);
  const given = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new CodPhoneVerificationError("Your mobile verification has expired. Please verify again.");
  }

  let payload: VerifiedTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as VerifiedTokenPayload;
  } catch {
    throw new CodPhoneVerificationError("Your mobile verification has expired. Please verify again.");
  }

  if (
    payload.phone !== phone ||
    !Number.isSafeInteger(payload.expiresAt) ||
    payload.expiresAt <= Date.now() ||
    typeof payload.nonce !== "string"
  ) {
    throw new CodPhoneVerificationError("Your mobile verification has expired. Please verify again.");
  }

  return { tokenHash: hashToken(token) };
}

/** Consume a verified OTP token exactly once, within the order transaction. */
export async function consumeCodVerification(
  tx: Db,
  input: { phone: string; tokenHash: string },
): Promise<void> {
  const [used] = await tx
    .update(codPhoneVerifications)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(codPhoneVerifications.phone, input.phone),
        eq(codPhoneVerifications.tokenHash, input.tokenHash),
        isNull(codPhoneVerifications.usedAt),
        gt(codPhoneVerifications.expiresAt, new Date()),
      ),
    )
    .returning({ id: codPhoneVerifications.id });

  if (!used) {
    throw new CodPhoneVerificationError(
      "Your mobile verification has expired or was already used. Please verify again.",
    );
  }
}
