import { verifyCodOtp, CodPhoneVerificationError } from "@/lib/cod-otp";
import { codOtpVerifySchema } from "@/lib/validations";
import {
  getClientIp,
  isSameOrigin,
  jsonError,
  jsonOk,
  readJson,
} from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Verify a submitted SMS code and issue a one-time COD checkout token. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "Invalid request origin.");

  const body = await readJson(request);
  if (body === null) return jsonError(400, "Malformed request body.");

  const parsed = codOtpVerifySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Enter the OTP sent to your mobile number.", {
      fieldErrors: { code: "Enter the OTP sent to your mobile number" },
    });
  }

  const ip = getClientIp(request);
  const phoneLimit = rateLimit({
    key: `cod-otp:verify:phone:${parsed.data.phone}`,
    limit: 8,
    windowMs: 10 * 60_000,
  });
  const ipLimit = rateLimit({
    key: `cod-otp:verify:ip:${ip}`,
    limit: 15,
    windowMs: 10 * 60_000,
  });
  if (!phoneLimit.ok || !ipLimit.ok) {
    const retryAfterSeconds = Math.max(
      phoneLimit.retryAfterSeconds,
      ipLimit.retryAfterSeconds,
    );
    return jsonError(
      429,
      `Too many attempts. Please wait ${retryAfterSeconds}s before trying again.`,
    );
  }

  try {
    const verificationToken = await verifyCodOtp(parsed.data.phone, parsed.data.code);
    return jsonOk({ verificationToken, message: "Mobile number verified for COD." });
  } catch (error) {
    if (error instanceof CodPhoneVerificationError) {
      return jsonError(400, error.message);
    }
    return jsonError(502, "We couldn't verify the code. Please try again.");
  }
}
