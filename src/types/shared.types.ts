/**
 * A Result type for handling operations that can succeed or fail.
 * Use this instead of throwing errors when you need explicit error handling.
 */
export type Result<TValue, TError extends Error> = { ok: true; value: TValue } | { ok: false; error: TError };
