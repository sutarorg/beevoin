/**
 * Grants admin access to a Supabase Auth user.
 *
 * Beevo stores no passwords: you create the person in Supabase
 * (Authentication → Users → Add user), copy their user UID, then authorise
 * that UID here. Nothing about the account is hardcoded in the codebase.
 *
 *   npm run admin:bootstrap -- --email you@example.com \
 *                              --supabase-id 00000000-0000-0000-0000-000000000000 \
 *                              --name "Your Name" --role owner
 *
 * Running it again for the same person updates their role and reactivates
 * them, so it doubles as a recovery path if you lock yourself out.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { adminUsers, adminRoles, type AdminRole } from "../src/db/schema";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
  const inline = process.argv.find((value) => value.startsWith(`--${name}=`));
  return inline?.split("=").slice(1).join("=");
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main() {
  const email = (arg("email") ?? process.env.BOOTSTRAP_ADMIN_EMAIL ?? "")
    .trim()
    .toLowerCase();
  const supabaseUserId = (
    arg("supabase-id") ??
    process.env.BOOTSTRAP_ADMIN_SUPABASE_ID ??
    ""
  ).trim();
  const name = (arg("name") ?? "").trim();
  const role = (arg("role") ?? "owner").trim() as AdminRole;

  if (!email || !supabaseUserId) {
    console.error(
      "Usage: npm run admin:bootstrap -- --email you@example.com --supabase-id <uuid> [--name 'Your Name'] [--role owner]",
    );
    process.exit(1);
  }
  if (!UUID_RE.test(supabaseUserId)) {
    console.error(
      "The Supabase user ID must be a UUID. Copy it from Supabase → Authentication → Users.",
    );
    process.exit(1);
  }
  if (!(adminRoles as readonly string[]).includes(role)) {
    console.error(`Role must be one of: ${adminRoles.join(", ")}`);
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    max: 1,
    ssl:
      connectionString.includes("localhost") ||
      connectionString.includes("127.0.0.1")
        ? false
        : { rejectUnauthorized: false },
  });
  const db = drizzle(pool);

  const [existing] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.supabaseUserId, supabaseUserId))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(adminUsers)
      .set({
        email,
        name: name || existing.name,
        role,
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(adminUsers.id, existing.id))
      .returning();
    console.log(`Updated ${updated.email}: role=${updated.role}, status=active.`);
  } else {
    const [created] = await db
      .insert(adminUsers)
      .values({ supabaseUserId, email, name, role, status: "active" })
      .returning();
    console.log(`Granted ${role} access to ${created.email}.`);
  }

  await pool.end();
  console.log("Sign in at /admin/login with this Supabase account.");
}

main().catch((error) => {
  console.error("Bootstrap failed:", error);
  process.exit(1);
});
