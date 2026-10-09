/** Disposable demo preview. Never uses an existing DATABASE_URL or production data. */
import EmbeddedPostgres from "embedded-postgres";
import { Pool } from "pg";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

async function main() {
  const directory = await mkdtemp(join(tmpdir(), "pos-preview-"));
  const password = randomBytes(24).toString("hex");
  const port = 15433;
  const postgres = new EmbeddedPostgres({ databaseDir: directory, user: "postgres", password, port,
    persistent: false, postgresFlags: ["-h", "127.0.0.1"], onLog: () => {}, onError: () => {} });
  let app: ReturnType<typeof spawn> | undefined;
  let admin: Pool | undefined;
  try {
    await postgres.initialise();
    await postgres.start();
    await postgres.createDatabase("pos_preview");
    const adminUrl = `postgresql://postgres:${password}@127.0.0.1:${port}/pos_preview`;
    admin = new Pool({ connectionString: adminUrl });
    await new Promise<void>((resolve, reject) => {
      const child = spawn("node_modules/.bin/tsx", ["scripts/migrate.ts"], {
        env: { ...process.env, MIGRATION_DATABASE_URL: adminUrl }, stdio: "inherit",
      });
      child.on("error", reject);
      child.on("exit", code => code === 0 ? resolve() : reject(new Error(`Migration failed: ${code}`)));
    });
    await admin.query(`CREATE ROLE pos_preview_runtime LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS;
      GRANT USAGE ON SCHEMA public TO pos_preview_runtime;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pos_preview_runtime;
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pos_preview_runtime;
      REVOKE ALL ON schema_migrations FROM pos_preview_runtime;
      REVOKE INSERT, UPDATE, DELETE ON security_meta FROM pos_preview_runtime;
      REVOKE CREATE ON SCHEMA public FROM PUBLIC;`);
    process.env.AUTH_SECRET = randomBytes(48).toString("hex");
    const { seedSecurityFixtures } = await import("../tests/security-fixtures");
    await seedSecurityFixtures(admin);
    const env: NodeJS.ProcessEnv = { ...process.env,
      DATABASE_URL: `postgresql://pos_preview_runtime:${password}@127.0.0.1:${port}/pos_preview`,
      NODE_ENV: "development", PIN_LOGIN_BRANCH_ID: "", MIGRATION_DATABASE_URL: "", TEST_ADMIN_URL: "",
    };
    console.log("Demo database ready. Owner: user1@test.invalid / Test-password-only-123!");
    app = spawn("node_modules/.bin/next", ["dev", "--hostname", "0.0.0.0", "--port", "3000"], { env, stdio: "inherit" });
    const stop = () => { app?.kill("SIGTERM"); };
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
    await new Promise<void>((resolve, reject) => {
      app!.on("error", reject);
      app!.on("exit", code => code === 0 || code === null ? resolve() : reject(new Error(`Preview exited: ${code}`)));
    });
  } finally {
    if (app && app.exitCode === null) app.kill("SIGTERM");
    await admin?.end();
    await postgres.stop();
    await rm(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
