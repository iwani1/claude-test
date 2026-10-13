"use client";

/**
 * The one way client code talks to the API (F5).
 *
 * Before this helper, 27 fetch sites parsed the JSON body without checking
 * the HTTP status, so a failed load could masquerade as an empty list and a
 * proxy 502 (non-JSON) surfaced as an unexplained parse error. apiFetch:
 *   - throws ApiClientError carrying the server's own `error` message on
 *     any non-2xx, so catches show what the server actually said;
 *   - throws ApiClientError("Request failed (502)") when an error body is
 *     not JSON at all (proxy/outage), never a raw SyntaxError;
 *   - returns the parsed body typed as T on success.
 *
 * Network failures (offline) still reject with the native TypeError, which
 * callers distinguish via apiErrorMessage / `instanceof ApiClientError`.
 */
export class ApiClientError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

export async function apiFetch<T = any>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Request failed (${res.status})`;
    throw new ApiClientError(message, res.status);
  }
  return data as T;
}

/** The message to show for a failed call: the server's words when we have
 *  them (ApiClientError), otherwise the caller's own fallback. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}
