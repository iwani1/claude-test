/**
 * Shared embedded-PostgreSQL helpers for the DB test runners (P13).
 *
 * Why this exists: when PostgreSQL cannot start (port already in use, bad data
 * folder…), embedded-postgres rejects `start()` with `undefined` and keeps a
 * handle to the exited process. Its `stop()` then waits for an `exit` event that
 * already happened, so the promise never settles; Node drains its event loop and
 * exits with code 0, and the runner reports nothing at all. These helpers turn
 * every such failure into a clear error and never call `stop()` on a server that
 * did not start.
 */
import EmbeddedPostgres from "embedded-postgres";
import { createServer } from "node:net";

/** Ask the OS for a free TCP port on 127.0.0.1. */
export async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => port ? resolve(port) : reject(new Error("could not pick a free port")));
    });
  });
}

/** Resolve if nothing listens on 127.0.0.1:port; reject with a clear message otherwise. */
export async function assertPortFree(port: number, what = "PostgreSQL"): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", (error: NodeJS.ErrnoException) => reject(new Error(
      error.code === "EADDRINUSE"
        ? `could not start ${what}: port ${port} on 127.0.0.1 is already in use (stop whatever is listening there)`
        : `could not start ${what}: cannot bind 127.0.0.1:${port} (${error.message})`)));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve()));
  });
}

export type TestPostgres = { pg: EmbeddedPostgres; port: number; stop: () => Promise<void> };

/**
 * Initialise and start a disposable PostgreSQL. Throws a clear Error (never
 * `undefined`, never a silent exit) if it cannot start, and returns a `stop`
 * that is safe to call whether or not the server started.
 */
export async function startTestPostgres(options: { databaseDir: string; password: string; port: number }): Promise<TestPostgres> {
  const { databaseDir, password, port } = options;
  // As root, PostgreSQL runs as the system "postgres" user (P12).
  const asRoot = process.getuid?.() === 0;
  const log: string[] = [];
  const keep = (message: unknown) => { log.push(String(message)); if (log.length > 40) log.shift(); };
  const pg = new EmbeddedPostgres({ databaseDir, user: "postgres", password, port, persistent: false, createPostgresUser: asRoot,
    postgresFlags: ["-h", "127.0.0.1"], onLog: keep,
    onError: message => { keep(message); if (String(message).includes("FATAL")) console.error(message); } });
  let started = false;
  const stop = async () => {
    if (!started) return;
    started = false;
    // Bounded: never let a stuck stop hang the runner.
    await Promise.race([pg.stop().catch(() => {}), new Promise<void>(resolve => setTimeout(resolve, 10_000).unref())]);
  };
  const fail = (step: string, error: unknown): never => {
    const detail = error instanceof Error ? error.message : "";
    const lines = log.join("").split("\n").filter(line => /FATAL|ERROR|could not|in use/i.test(line)).slice(-5).join("\n");
    throw new Error(`could not ${step} PostgreSQL on port ${port} (is it in use?)${detail ? `: ${detail}` : ""}${lines ? `\nPostgreSQL said:\n${lines}` : ""}`);
  };
  await assertPortFree(port);
  try { await pg.initialise(); } catch (error) { fail("initialise", error); }
  try { await pg.start(); } catch (error) { fail("start", error); }
  started = true;
  return { pg, port, stop };
}

/**
 * Fail loudly if the process is about to exit while `main()` is still pending:
 * an unsettled promise with an empty event loop otherwise exits with code 0.
 */
export function failIfUnfinished(name: string): { done: () => void } {
  let finished = false;
  process.on("beforeExit", () => {
    if (finished) return;
    console.error(`\n${name}: stopped before finishing (a step never completed); treating as failure.`);
    process.exit(1);
  });
  return { done: () => { finished = true; } };
}
