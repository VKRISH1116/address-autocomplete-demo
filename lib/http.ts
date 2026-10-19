import { ProviderError } from "@/lib/providers";

/** A plain JSON error body: { error: "message" }. */
export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

/** Turns any thrown error into a JSON response without leaking details. */
export function handleError(e: unknown) {
  if (e instanceof ProviderError) return jsonError(e.message, e.status);
  console.error(e);
  return jsonError("Something went wrong. Try again.", 500);
}

/** Session tokens are UUIDs made in the browser; reject anything else. */
export function validSessionToken(s: string | null): s is string {
  return !!s && /^[A-Za-z0-9-]{8,64}$/.test(s);
}
