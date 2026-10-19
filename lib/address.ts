/**
 * The address shape used everywhere in this demo: six plain strings, the same
 * shape a typical "billing address" form saves.
 */
export type AddressDraft = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export const BLANK_ADDRESS: AddressDraft = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "US",
};

/** US states, DC and the inhabited territories USPS delivers to. */
export const US_STATES: ReadonlyArray<{ code: string; name: string }> = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
  { code: "AS", name: "American Samoa" },
  { code: "GU", name: "Guam" },
  { code: "MP", name: "Northern Mariana Islands" },
  { code: "PR", name: "Puerto Rico" },
  { code: "VI", name: "U.S. Virgin Islands" },
];

const STATE_CODES = new Set(US_STATES.map((s) => s.code));

/** 5-digit ZIP, or ZIP+4 written as 12345-6789. */
export const ZIP_PATTERN = /^\d{5}(-\d{4})?$/;

export type AddressErrors = Partial<Record<keyof AddressDraft, string>> & {
  form?: string;
};

export function trimAddress(a: AddressDraft): AddressDraft {
  return {
    line1: a.line1.trim(),
    line2: a.line2.trim(),
    city: a.city.trim(),
    state: a.state.trim().toUpperCase(),
    postalCode: a.postalCode.trim(),
    country: a.country.trim().toUpperCase() || "US",
  };
}

export function isEmptyAddress(a: AddressDraft): boolean {
  return !a.line1 && !a.line2 && !a.city && !a.state && !a.postalCode;
}

/**
 * The address is optional, but if any core part is filled in, all four are
 * required: street, city, state and ZIP. Returns an empty object when valid.
 */
export function checkAddress(raw: AddressDraft): AddressErrors {
  const a = trimAddress(raw);
  if (isEmptyAddress(a)) return {};
  const errors: AddressErrors = {};
  const core = [a.line1, a.city, a.state, a.postalCode];
  if (core.some((v) => v === "")) {
    errors.form =
      "An address needs Street, City, State and ZIP code, or leave all of them empty.";
    if (!a.line1) errors.line1 = "Enter the street address.";
    if (!a.city) errors.city = "Enter the city.";
    if (!a.state) errors.state = "Choose a state.";
    if (!a.postalCode) errors.postalCode = "Enter the ZIP code.";
  }
  if (a.state && a.country === "US" && !STATE_CODES.has(a.state)) {
    errors.state = "Choose a state from the list.";
  }
  if (a.postalCode && a.country === "US" && !ZIP_PATTERN.test(a.postalCode)) {
    errors.postalCode = "Use 5 digits, or ZIP+4 like 78701-1234.";
  }
  return errors;
}

export function formatOneLine(a: AddressDraft): string {
  const t = trimAddress(a);
  const street = [t.line1, t.line2].filter(Boolean).join(", ");
  const cityLine = [t.city, [t.state, t.postalCode].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return [street, cityLine, t.country].filter(Boolean).join(", ");
}

/** One part of a Google Places (New) `addressComponents` array. */
export type GoogleAddressComponent = {
  longText: string;
  shortText: string;
  types: string[];
};

/**
 * Turns Google's address parts into the six form fields.
 * street_number + route -> line1, subpremise -> line2, locality -> city
 * (falling back to postal_town / sublocality), admin area 1 (short) -> state,
 * postal_code (+ suffix) -> postalCode, country (short) -> country.
 */
export function mapGoogleComponents(
  components: GoogleAddressComponent[],
): AddressDraft {
  const get = (type: string, short = false) => {
    const c = components.find((x) => x.types.includes(type));
    return c ? (short ? c.shortText : c.longText) : "";
  };
  const street = [get("street_number"), get("route", true) || get("route")]
    .filter(Boolean)
    .join(" ");
  const zip = get("postal_code");
  const zip4 = get("postal_code_suffix");
  // Google returns a bare unit ("200") or a labelled one ("Suite 200").
  const unit = get("subpremise");
  return {
    line1: street,
    line2: unit && /^[\dA-Z]/.test(unit) && !/\s/.test(unit) ? `Unit ${unit}` : unit,
    city:
      get("locality") ||
      get("postal_town") ||
      get("sublocality_level_1") ||
      get("sublocality") ||
      get("administrative_area_level_3"),
    state: get("administrative_area_level_1", true),
    postalCode: zip && zip4 ? `${zip}-${zip4}` : zip,
    country: get("country", true) || "US",
  };
}

/** Which fields differ between two addresses (case-insensitive). */
export function changedFields(
  a: AddressDraft,
  b: AddressDraft,
): Array<keyof AddressDraft> {
  const keys: Array<keyof AddressDraft> = [
    "line1",
    "line2",
    "city",
    "state",
    "postalCode",
    "country",
  ];
  return keys.filter(
    (k) => a[k].trim().toLowerCase() !== b[k].trim().toLowerCase(),
  );
}
