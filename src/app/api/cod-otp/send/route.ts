import { sendCodOtp, CodPhoneVerificationError } from "@/lib/cod-otp";
import { codOtpSendSchema } from "@/lib/validations";
import {
  getClientIp,
  isSameOrigin,
  jsonError,
  jsonOk,
  readJson,
} from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Send an SMS OTP only for the COD checkout flow. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "Invalid request origin.");

  const body = await readJson(request);
  if (body === null) return jsonError(400, "Malformed request body.");

  const parsed = codOtpSendSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Enter a valid 10-digit Indian mobile number.", {
      fieldErrors: { phone: "Enter a valid 10-digit Indian mobile number" },
    });
  }

  const ip = getClientIp(request);
  const phoneLimit = rateLimit({
    key: `cod-otp:send:phone:${parsed.data.phone}`,
    limit: 3,
    windowMs: 10 * 60_000,
  });
  const ipLimit = rateLimit({
    key: `cod-otp:send:ip:${ip}`,
    limit: 10,
    windowMs: 10 * 60_000,
  });
  if (!phoneLimit.ok || !ipLimit.ok) {
    const retryAfterSeconds = Math.max(
      phoneLimit.retryAfterSeconds,
      ipLimit.retryAfterSeconds,
    );
    return jsonError(
      429,
      `Too many code requests. Please wait ${retryAfterSeconds}s before trying again.`,
    );
  }

  try {
    await sendCodOtp(parsed.data.phone);
    return jsonOk({ message: "OTP sent to your mobile number." });
  } catch (error) {
    if (error instanceof CodPhoneVerificationError) {
      return jsonError(400, error.message);
    }
    return jsonError(502, "We couldn't send the verification code. Please try again.");
  }
}
