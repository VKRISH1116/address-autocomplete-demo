import { trimAddress, type AddressDraft } from "@/lib/address";
import { ProviderError, type AddressValidator, type ValidationResult } from "./types";

/**
 * USPS Addresses API v3 (free; needs a USPS developer account).
 *  - Portal / app keys: https://developers.usps.com
 *  - OAuth 2.0 client-credentials token, then GET /addresses/v3/address.
 * Validation only: USPS has no "as you type" suggestions.
 */

const BASE = process.env.USPS_API_BASE ?? "https://apis.usps.com";
const TIMEOUT_MS = 8000;

let cached: { token: string; expiresAt: number } | null = null;

async function token(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const id = process.env.USPS_CLIENT_ID;
  const secret = process.env.USPS_CLIENT_SECRET;
  if (!id || !secret) {
    throw new ProviderError(
      "USPS_CLIENT_ID / USPS_CLIENT_SECRET are not set. Add them to .env.local or use VALIDATOR=mock.",
      500,
    );
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}/oauth2/v3/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: id,
        client_secret: secret,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new ProviderError("Could not reach USPS. Try again.");
  }
  const body = (await res.json().catch(() => null)) as
    | { access_token?: string; expires_in?: number }
    | null;
  if (!res.ok || !body?.access_token) {
    console.error("[usps] token", res.status);
    throw new ProviderError(`USPS refused the sign-in (HTTP ${res.status}). Check the client ID and secret.`);
  }
  cached = {
    token: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  return cached.token;
}

type UspsAddressResponse = {
  address?: {
    streetAddress?: string;
    secondaryAddress?: string;
    city?: string;
    state?: string;
    ZIPCode?: string;
    ZIPPlus4?: string;
  };
  additionalInfo?: { DPVConfirmation?: string };
  corrections?: Array<{ code?: string; text?: string }>;
  error?: { message?: string };
};

export const uspsValidator: AddressValidator = {
  name: "usps",
  async validate(raw): Promise<ValidationResult> {
    const a = trimAddress(raw);
    const url = new URL(`${BASE}/addresses/v3/address`);
    url.searchParams.set("streetAddress", a.line1);
    if (a.line2) url.searchParams.set("secondaryAddress", a.line2);
    url.searchParams.set("city", a.city);
    url.searchParams.set("state", a.state);
    url.searchParams.set("ZIPCode", a.postalCode.slice(0, 5));

    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${await token()}`, Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (e) {
      if (e instanceof ProviderError) throw e;
      throw new ProviderError("Could not reach USPS. Try again.");
    }
    const body = (await res.json().catch(() => null)) as UspsAddressResponse | null;

    // USPS answers 400/404 when it cannot find the address at all.
    if (res.status === 400 || res.status === 404) {
      return {
        verdict: "invalid",
        standardized: null,
        messages: [body?.error?.message ?? "USPS could not find this address."],
        source: "usps",
      };
    }
    if (!res.ok || !body?.address) {
      console.error("[usps] address", res.status);
      throw new ProviderError(`USPS returned an error (HTTP ${res.status}).`);
    }

    const u = body.address;
    const standardized: AddressDraft = {
      line1: u.streetAddress ?? a.line1,
      line2: u.secondaryAddress ?? "",
      city: u.city ?? a.city,
      state: u.state ?? a.state,
      postalCode: u.ZIPPlus4 ? `${u.ZIPCode}-${u.ZIPPlus4}` : (u.ZIPCode ?? a.postalCode),
      country: "US",
    };

    // DPV: Y = confirmed, S = confirmed but suite/apt not matched,
    // D = confirmed but suite/apt missing, N = not deliverable.
    const dpv = body.additionalInfo?.DPVConfirmation ?? "";
    const messages = (body.corrections ?? [])
      .map((c) => c.text)
      .filter((t): t is string => Boolean(t));
    let verdict: ValidationResult["verdict"];
    if (dpv === "Y") {
      verdict = "corrected";
      messages.unshift("Confirmed by USPS and standardized.");
    } else if (dpv === "S" || dpv === "D") {
      verdict = "unconfirmed";
      messages.unshift("USPS confirmed the building, but the suite or apartment number is missing or wrong.");
    } else {
      verdict = "invalid";
      messages.unshift("USPS says mail cannot be delivered to this address.");
    }
    return { verdict, standardized, messages, source: "usps" };
  },
};
