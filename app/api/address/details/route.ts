import type { NextRequest } from "next/server";
import { suggestProvider } from "@/lib/providers";
import { handleError, jsonError, validSessionToken } from "@/lib/http";

/** GET /api/address/details?id=<suggestion id>&session=<uuid> */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const session = req.nextUrl.searchParams.get("session");
  if (!id || id.length > 300) return jsonError("Missing or bad suggestion id.", 400);
  if (!validSessionToken(session)) return jsonError("Missing or bad session token.", 400);
  try {
    const address = await suggestProvider().details(id, session);
    return Response.json({ address });
  } catch (e) {
    return handleError(e);
  }
}
