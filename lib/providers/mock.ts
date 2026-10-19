import { trimAddress, US_STATES, type AddressDraft } from "@/lib/address";
import type {
  AddressValidator,
  Suggestion,
  SuggestProvider,
  ValidationResult,
} from "./types";

/**
 * Offline sample data so the whole flow works with no API keys.
 * The ZIP+4 values are realistic-looking but made up.
 */
const SAMPLES: Array<AddressDraft & { id: string; zip4: string }> = [
  { id: "m1", line1: "100 Congress Ave", line2: "", city: "Austin", state: "TX", postalCode: "78701", country: "US", zip4: "2902" },
  { id: "m2", line1: "100 Main St", line2: "", city: "Houston", state: "TX", postalCode: "77002", country: "US", zip4: "1035" },
  { id: "m3", line1: "100 Main St", line2: "", city: "Boston", state: "MA", postalCode: "02129", country: "US", zip4: "3500" },
  { id: "m4", line1: "100 Market St", line2: "", city: "San Francisco", state: "CA", postalCode: "94105", country: "US", zip4: "1420" },
  { id: "m5", line1: "1600 Amphitheatre Pkwy", line2: "", city: "Mountain View", state: "CA", postalCode: "94043", country: "US", zip4: "1351" },
  { id: "m6", line1: "350 5th Ave", line2: "", city: "New York", state: "NY", postalCode: "10118", country: "US", zip4: "0110" },
  { id: "m7", line1: "233 S Wacker Dr", line2: "", city: "Chicago", state: "IL", postalCode: "60606", country: "US", zip4: "6306" },
  { id: "m8", line1: "600 Montgomery St", line2: "", city: "San Francisco", state: "CA", postalCode: "94111", country: "US", zip4: "2702" },
  { id: "m9", line1: "1 Microsoft Way", line2: "", city: "Redmond", state: "WA", postalCode: "98052", country: "US", zip4: "6399" },
  { id: "m10", line1: "400 Broad St", line2: "", city: "Seattle", state: "WA", postalCode: "98109", country: "US", zip4: "4607" },
  { id: "m11", line1: "1000 5th Ave", line2: "", city: "New York", state: "NY", postalCode: "10028", country: "US", zip4: "0198" },
  { id: "m12", line1: "2 15th St NW", line2: "", city: "Washington", state: "DC", postalCode: "20024", country: "US", zip4: "2000" },
];

const fold = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export const mockSuggest: SuggestProvider = {
  name: "mock",
  async autocomplete(input) {
    const q = fold(input);
    if (q.length < 3) return [];
    return SAMPLES.filter((s) =>
      fold(`${s.line1} ${s.city} ${s.state} ${s.postalCode}`).includes(q),
    )
      .slice(0, 5)
      .map<Suggestion>((s) => ({
        id: s.id,
        main: s.line1,
        secondary: `${s.city}, ${s.state} ${s.postalCode}, USA`,
      }));
  },
  async details(id) {
    const s = SAMPLES.find((x) => x.id === id);
    if (!s) throw new Error("Unknown sample address.");
    return {
      line1: s.line1,
      line2: s.line2,
      city: s.city,
      state: s.state,
      postalCode: s.postalCode,
      country: s.country,
    };
  },
};

/** USPS-style abbreviations (Publication 28) for the most common words. */
const ABBREVIATIONS: Record<string, string> = {
  street: "ST", st: "ST", avenue: "AVE", ave: "AVE", av: "AVE",
  road: "RD", rd: "RD", boulevard: "BLVD", blvd: "BLVD", drive: "DR",
  dr: "DR", lane: "LN", ln: "LN", parkway: "PKWY", pkwy: "PKWY",
  court: "CT", ct: "CT", place: "PL", pl: "PL", highway: "HWY",
  hwy: "HWY", way: "WAY", circle: "CIR", terrace: "TER", square: "SQ",
  suite: "STE", ste: "STE", apartment: "APT", apt: "APT", unit: "UNIT",
  floor: "FL", building: "BLDG", north: "N", south: "S", east: "E",
  west: "W", northeast: "NE", northwest: "NW", southeast: "SE",
  southwest: "SW", first: "1ST", second: "2ND", third: "3RD", fifth: "5TH",
};

function uspsLine(line: string): string {
  return line
    .replace(/[.,#]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => ABBREVIATIONS[w.toLowerCase()] ?? w.toUpperCase())
    .join(" ");
}

function stateCode(state: string): string {
  const s = state.trim();
  const byCode = US_STATES.find((x) => x.code === s.toUpperCase());
  if (byCode) return byCode.code;
  const byName = US_STATES.find((x) => x.name.toLowerCase() === s.toLowerCase());
  return byName ? byName.code : s.toUpperCase();
}

export const mockValidator: AddressValidator = {
  name: "mock",
  async validate(raw): Promise<ValidationResult> {
    const a = trimAddress(raw);
    if (!a.line1 || !a.city || !a.state || !a.postalCode) {
      return {
        verdict: "invalid",
        standardized: null,
        messages: ["Street, city, state and ZIP are all needed to check an address."],
        source: "mock",
      };
    }
    const standardized: AddressDraft = {
      line1: uspsLine(a.line1),
      line2: a.line2 ? uspsLine(a.line2) : "",
      city: a.city.toUpperCase(),
      state: stateCode(a.state),
      postalCode: a.postalCode.slice(0, 5),
      country: "US",
    };
    const known = SAMPLES.find(
      (s) =>
        uspsLine(s.line1) === standardized.line1 &&
        s.postalCode === standardized.postalCode,
    );
    if (known) {
      standardized.postalCode = `${known.postalCode}-${known.zip4}`;
      standardized.city = known.city.toUpperCase();
      standardized.state = known.state;
    }
    const messages: string[] = [];
    if (!known) {
      messages.push(
        "Demo mode only knows a few sample addresses, so this one could not be confirmed. With a real key the address service would check it.",
      );
    } else {
      messages.push("Standardized to USPS style and ZIP+4 added (demo data).");
    }
    return {
      verdict: known ? "corrected" : "unconfirmed",
      standardized,
      messages,
      source: "mock",
    };
  },
};
