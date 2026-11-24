import { Pool } from "pg";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { assertPortFree, failIfUnfinished, startTestPostgres, type TestPostgres } from "./embedded-pg";
async function run(command: string, args: string[], env = process.env) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`${command} failed: ${code}`)));
  });
}
async function main() {
  // Ghana is UTC+0 and the server runs in UTC; pin it so date-based checks
  // (reports, custom ranges) mean the same on any machine.
  process.env.TZ = "UTC";
  // Only disposable resources; never use the developer's DATABASE_URL.
  const directory = await mkdtemp(join(tmpdir(), "pos-security-"));
  const password = randomBytes(24).toString("hex");
  const port = 15432;
  // startTestPostgres runs PostgreSQL as the system "postgres" user when we are
  // root (P12), and turns startup failures (port in use…) into a clear error
  // instead of a silent exit 0 (P13).
  let db: TestPostgres | undefined;
  let app: ReturnType<typeof spawn> | undefined;
  let admin: Pool | undefined;
  try {
    await assertPortFree(3100, "the app");
    db = await startTestPostgres({ databaseDir: directory, password, port });
    await db.pg.createDatabase("pos_security_test");
    const adminUrl = `postgresql://postgres:${password}@127.0.0.1:${port}/pos_security_test`;
    admin = new Pool({ connectionString: adminUrl });
    await run("node_modules/.bin/tsx", ["scripts/migrate.ts"], { ...process.env, MIGRATION_DATABASE_URL: adminUrl });
    await admin.query(`CREATE ROLE pos_runtime LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS; GRANT USAGE ON SCHEMA public TO pos_runtime; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pos_runtime; GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pos_runtime; REVOKE ALL ON schema_migrations FROM pos_runtime; REVOKE INSERT, UPDATE, DELETE ON security_meta FROM pos_runtime;`);
    process.env.AUTH_SECRET = randomBytes(48).toString("hex");
    process.env.DATABASE_URL = `postgresql://pos_runtime:${password}@127.0.0.1:${port}/pos_security_test`;
    process.env.TEST_ADMIN_URL = adminUrl;
    const { seedSecurityFixtures } = await import("./security-fixtures");
    await seedSecurityFixtures(admin);
    await run("node_modules/.bin/next", ["build"]);
    app = spawn("node_modules/.bin/next", ["start", "--hostname", "0.0.0.0", "--port", "3100"], { env: { ...process.env, PIN_LOGIN_BRANCH_ID: "", NODE_ENV: "production", POS_DB_LOCK_TIMEOUT_MS: "1500" }, stdio: ["ignore", "pipe", "pipe"] });
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Next server startup timeout")), 90_000);
      app!.once("exit", code => { clearTimeout(timeout); reject(new Error(`Next exited ${code}`)); });
      app!.stdout!.on("data", data => { const text = String(data); if (/Ready in/.test(text)) { clearTimeout(timeout); resolve(); } });
      app!.stderr!.on("data", data => { if (process.env.TEST_VERBOSE) process.stderr.write(data); });
    });
    await run("node_modules/.bin/tsx", ["tests/security.ts"]);
    await run("node_modules/.bin/tsx", ["tests/pilot.ts"]);
    await run("node_modules/.bin/tsx", ["tests/accounting.ts"]);
  } finally {
    if (app && app.exitCode === null) {
      app.kill("SIGTERM");
      await new Promise<void>(resolve => { app!.once("exit", () => resolve()); setTimeout(() => { app!.kill("SIGKILL"); resolve(); }, 5000).unref(); });
    }
    await admin?.end(); await db?.stop(); await rm(directory, { recursive: true, force: true });
  }
}
const guard = failIfUnfinished("test:security");
main().then(() => { guard.done(); process.exit(0); }, error => { guard.done(); console.error(error ?? "test:security failed with no error detail"); process.exit(1); });
