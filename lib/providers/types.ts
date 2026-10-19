import type { AddressDraft } from "@/lib/address";

/** One row in the "as you type" dropdown. */
export type Suggestion = {
  id: string;
  /** Usually the street part, e.g. "100 Congress Ave". */
  main: string;
  /** Usually the rest, e.g. "Austin, TX, USA". */
  secondary: string;
};

/**
 * valid       - deliverable as typed (maybe only re-formatted)
 * corrected   - deliverable, but parts were fixed or added (e.g. ZIP+4)
 * unconfirmed - could not confirm it all (e.g. missing apartment number)
 * invalid     - not a deliverable address
 */
export type Verdict = "valid" | "corrected" | "unconfirmed" | "invalid";

export type ValidationResult = {
  verdict: Verdict;
  /** The standardized (USPS-style) address, when the service returned one. */
  standardized: AddressDraft | null;
  /** Plain-language notes to show the user. */
  messages: string[];
  /** Which service answered: "mock", "google" or "usps". */
  source: string;
};

/** Gives suggestions while typing and turns a picked one into fields. */
export interface SuggestProvider {
  name: string;
  autocomplete(input: string, sessionToken: string): Promise<Suggestion[]>;
  details(id: string, sessionToken: string): Promise<AddressDraft>;
}

/** Checks and standardizes a full address (runs on Save). */
export interface AddressValidator {
  name: string;
  validate(address: AddressDraft): Promise<ValidationResult>;
}

/** A problem the user should see as a plain message, not a crash. */
export class ProviderError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}
