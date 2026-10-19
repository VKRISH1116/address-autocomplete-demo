import type { NextRequest } from "next/server";
import { suggestProvider } from "@/lib/providers";
import { handleError, jsonError, validSessionToken } from "@/lib/http";

/** GET /api/address/autocomplete?q=100%20congress&session=<uuid> */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const session = req.nextUrl.searchParams.get("session");
  if (q.length > 200) return jsonError("Search text is too long.", 400);
  if (!validSessionToken(session)) return jsonError("Missing or bad session token.", 400);
  try {
    const provider = suggestProvider();
    const suggestions = q.length < 3 ? [] : await provider.autocomplete(q, session);
    return Response.json({ provider: provider.name, suggestions });
  } catch (e) {
    return handleError(e);
  }
}
