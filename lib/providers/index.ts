import { googleSuggest, googleValidator } from "./google";
import { mockSuggest, mockValidator } from "./mock";
import { uspsValidator } from "./usps";
import { ProviderError, type AddressValidator, type SuggestProvider } from "./types";

/**
 * Chooses the services from environment variables (see .env.example):
 *   ADDRESS_PROVIDER = mock | google        (suggestions while typing)
 *   VALIDATOR        = mock | google | usps (check on Save)
 * With nothing set, everything runs on built-in demo data.
 */
export function suggestProvider(): SuggestProvider {
  const name = (process.env.ADDRESS_PROVIDER ?? "mock").toLowerCase();
  if (name === "google") return googleSuggest;
  if (name === "mock") return mockSuggest;
  throw new ProviderError(`Unknown ADDRESS_PROVIDER "${name}". Use mock or google.`, 500);
}

export function validator(): AddressValidator {
  const fallback = (process.env.ADDRESS_PROVIDER ?? "mock").toLowerCase() === "google" ? "google" : "mock";
  const name = (process.env.VALIDATOR ?? fallback).toLowerCase();
  if (name === "google") return googleValidator;
  if (name === "usps") return uspsValidator;
  if (name === "mock") return mockValidator;
  throw new ProviderError(`Unknown VALIDATOR "${name}". Use mock, google or usps.`, 500);
}

export { ProviderError };
