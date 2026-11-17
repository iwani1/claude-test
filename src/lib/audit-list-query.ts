import { ApiError } from "./api";
import { reportWindow } from "./collection-report";

/** Both audit histories use the same whole-day Ghana (UTC) dates and bounded
 * pages. No dates means the newest records, with older pages available. */
export function auditListQuery(params: URLSearchParams, defaultLimit: number, maxLimit: number) {
  const requested = Number(params.get("limit") || defaultLimit);
  const limit = Number.isSafeInteger(requested) && requested > 0
    ? Math.min(requested, maxLimit)
    : defaultLimit;
  const offsetText = params.get("offset");
  const offset = offsetText === null ? 0 : Number(offsetText);
  if (!Number.isSafeInteger(offset) || offset < 0 || (offsetText !== null && !/^\d+$/.test(offsetText))) {
    throw new ApiError(400, "Offset must be a non-negative integer");
  }

  const from = params.get("from");
  const to = params.get("to");
  if ((from === null) !== (to === null)) {
    throw new ApiError(400, "Choose both a start date and an end date");
  }
  // reportWindow validates strict YYYY-MM-DD dates, rejects impossible days
  // and reversed ranges, and returns [start midnight, day after end midnight).
  const window = from === null ? null : reportWindow("custom", new Date(), { start: from, end: to! });
  return { limit, offset, window };
}
