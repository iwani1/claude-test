import { ApiError } from "./api";
// Reject excess precision, exponents, non-finite numbers, and negative values.
export function moneyCents(value: unknown, allowZero = false): number {
  if ((typeof value !== "string" && typeof value !== "number") || !/^\d+(\.\d{1,2})?$/.test(String(value))) throw new ApiError(400, "Invalid monetary amount");
  const cents = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(cents) || cents > 9_999_999_999 || cents < (allowZero ? 0 : 1)) throw new ApiError(400, "Monetary amount out of range");
  return cents;
}
