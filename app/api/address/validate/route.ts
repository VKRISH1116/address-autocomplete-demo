import { validator } from "@/lib/providers";
import { handleError, jsonError } from "@/lib/http";
import type { AddressDraft } from "@/lib/address";

const FIELDS: Array<keyof AddressDraft> = [
  "line1",
  "line2",
  "city",
  "state",
  "postalCode",
  "country",
];

/** POST /api/address/validate  body: { line1, line2, city, state, postalCode, country } */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return jsonError("Send the address as JSON.", 400);

  const address = {} as AddressDraft;
  for (const f of FIELDS) {
    const v = body[f] ?? "";
    if (typeof v !== "string" || v.length > 200) {
      return jsonError(`Field "${f}" must be text of at most 200 characters.`, 400);
    }
    address[f] = v;
  }
  try {
    const v = validator();
    const result = await v.validate(address);
    return Response.json(result);
  } catch (e) {
    return handleError(e);
  }
}
