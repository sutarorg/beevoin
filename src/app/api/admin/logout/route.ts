import { clearAdminSession } from "@/lib/admin-auth";
import { jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function POST() {
  await clearAdminSession();
  return jsonOk({ redirect: "/admin/login" });
}
