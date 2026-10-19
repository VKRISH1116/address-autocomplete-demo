import {
  mapGoogleComponents,
  trimAddress,
  type AddressDraft,
  type GoogleAddressComponent,
} from "@/lib/address";
import {
  ProviderError,
  type AddressValidator,
  type Suggestion,
  type SuggestProvider,
  type ValidationResult,
} from "./types";

/**
 * Google Maps Platform, called from the server so the key never reaches the
 * browser.
 *  - Places API (New) Autocomplete: https://developers.google.com/maps/documentation/places/web-service/place-autocomplete
 *  - Places API (New) Place Details: https://developers.google.com/maps/documentation/places/web-service/place-details
 *  - Address Validation API:        https://developers.google.com/maps/documentation/address-validation
 *
 * Autocomplete requests that share a session token and end with a Place
 * Details call are billed as one session.
 */

const TIMEOUT_MS = 8000;

function key(): string {
  const k = process.env.GOOGLE_MAPS_API_KEY;
  if (!k) {
    throw new ProviderError(
      "GOOGLE_MAPS_API_KEY is not set. Add it to .env.local or use ADDRESS_PROVIDER=mock.",
      500,
    );
  }
  return k;
}

async function call<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch {
    throw new ProviderError("Could not reach the Google address service. Try again.");
  }
  const body = (await res.json().catch(() => null)) as
    | (T & { error?: { message?: string; status?: string } })
    | null;
  if (!res.ok || !body) {
    // Log the detail on the server only; show the user a short message.
    console.error("[google]", res.status, body?.error?.status, body?.error?.message);
    const hint =
      res.status === 403
        ? " Check that the key is valid and that this API is enabled for it."
        : "";
    throw new ProviderError(`The Google address service refused the request (HTTP ${res.status}).${hint}`);
  }
  return body;
}

type AutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId: string;
      text?: { text: string };
      structuredFormat?: {
        mainText?: { text: string };
        secondaryText?: { text: string };
      };
    };
  }>;
};

type DetailsResponse = {
  addressComponents?: GoogleAddressComponent[];
  formattedAddress?: string;
};

export const googleSuggest: SuggestProvider = {
  name: "google",
  async autocomplete(input, sessionToken) {
    const body = await call<AutocompleteResponse>(
      "https://places.googleapis.com/v1/places:autocomplete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key(),
          // Ask only for what the dropdown shows.
          "X-Goog-FieldMask":
            "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
        },
        body: JSON.stringify({
          input,
          sessionToken,
          includedRegionCodes: ["us"],
          // Street-level results only, not businesses or cities.
          includedPrimaryTypes: ["street_address", "premise", "subpremise"],
        }),
      },
    );
    return (body.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
      .slice(0, 5)
      .map<Suggestion>((p) => ({
        id: p.placeId,
        main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        secondary: p.structuredFormat?.secondaryText?.text ?? "",
      }));
  },
  async details(placeId, sessionToken) {
    const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
    url.searchParams.set("sessionToken", sessionToken);
    const body = await call<DetailsResponse>(url.toString(), {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": key(),
        "X-Goog-FieldMask": "addressComponents,formattedAddress",
      },
    });
    if (!body.addressComponents?.length) {
      throw new ProviderError("Google returned no address parts for that place.");
    }
    return mapGoogleComponents(body.addressComponents);
  },
};

type ValidateResponse = {
  result?: {
    verdict?: {
      addressComplete?: boolean;
      validationGranularity?: string;
      hasUnconfirmedComponents?: boolean;
      hasInferredComponents?: boolean;
      hasReplacedComponents?: boolean;
    };
    uspsData?: {
      standardizedAddress?: {
        firstAddressLine?: string;
        secondAddressLine?: string;
        city?: string;
        state?: string;
        zipCode?: string;
        zipCodeExtension?: string;
      };
      dpvConfirmation?: string;
    };
  };
};

export const googleValidator: AddressValidator = {
  name: "google",
  async validate(raw): Promise<ValidationResult> {
    const a = trimAddress(raw);
    const body = await call<ValidateResponse>(
      "https://addressvalidation.googleapis.com/v1:validateAddress",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key() },
        body: JSON.stringify({
          address: {
            regionCode: a.country || "US",
            addressLines: [a.line1, a.line2].filter(Boolean),
            locality: a.city,
            administrativeArea: a.state,
            postalCode: a.postalCode,
          },
          // Ask for the USPS CASS check (US and Puerto Rico only).
          enableUspsCass: true,
        }),
      },
    );
    const v = body.result?.verdict ?? {};
    const usps = body.result?.uspsData?.standardizedAddress;
    const standardized: AddressDraft | null = usps?.firstAddressLine
      ? {
          line1: usps.firstAddressLine,
          line2: usps.secondAddressLine ?? "",
          city: usps.city ?? a.city,
          state: usps.state ?? a.state,
          postalCode: usps.zipCodeExtension
            ? `${usps.zipCode}-${usps.zipCodeExtension}`
            : (usps.zipCode ?? a.postalCode),
          country: "US",
        }
      : null;

    const premiseLevel = ["PREMISE", "SUB_PREMISE"].includes(v.validationGranularity ?? "");
    const messages: string[] = [];
    let verdict: ValidationResult["verdict"];
    if (!v.addressComplete || !premiseLevel) {
      verdict = standardized ? "unconfirmed" : "invalid";
      messages.push(
        verdict === "invalid"
          ? "This address could not be found. Check the street and number."
          : "Part of this address could not be confirmed (for example a missing suite or apartment number).",
      );
    } else if (v.hasInferredComponents || v.hasReplacedComponents) {
      verdict = "corrected";
      messages.push("Some parts were corrected or added (for example the ZIP+4).");
    } else {
      verdict = "valid";
      messages.push("Address confirmed.");
    }
    if (v.hasUnconfirmedComponents && verdict !== "invalid") {
      messages.push("Google could not confirm every part. Double-check before saving.");
    }
    return { verdict, standardized, messages, source: "google" };
  },
};
