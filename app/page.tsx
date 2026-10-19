import { Suspense } from "react";
import { connection } from "next/server";
import { Demo } from "@/components/Demo";

function modeLabel(): { suggest: string; check: string; demo: boolean } {
  const suggest = (process.env.ADDRESS_PROVIDER ?? "mock").toLowerCase();
  const check = (process.env.VALIDATOR ?? (suggest === "google" ? "google" : "mock")).toLowerCase();
  const names: Record<string, string> = {
    mock: "built-in demo data",
    google: "Google",
    usps: "USPS",
  };
  return {
    suggest: names[suggest] ?? suggest,
    check: names[check] ?? check,
    demo: suggest === "mock" || check === "mock",
  };
}

/** Reads the mode at request time, so editing .env.local + restarting shows it. */
async function ModeBadges() {
  await connection();
  const mode = modeLabel();
  return (
    <p className="mt-3 inline-flex flex-wrap gap-2 text-xs">
      <span className="rounded-full bg-white px-3 py-1 text-zinc-800 ring-1 ring-zinc-300">
        Suggestions: <strong>{mode.suggest}</strong>
      </span>
      <span className="rounded-full bg-white px-3 py-1 text-zinc-800 ring-1 ring-zinc-300">
        Address check: <strong>{mode.check}</strong>
      </span>
      {mode.demo && (
        <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-900 ring-1 ring-amber-300">
          Demo mode: try “100 Ma” or “1600 Amph”. Add API keys in .env.local for real data.
        </span>
      )}
    </p>
  );
}

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Address autocomplete demo</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-700">
          Start typing a street address. Pick a suggestion and the city, state and ZIP fill in.
          When you press Save, the address is checked and standardized USPS-style, and you
          choose between what you typed and the suggested version.
        </p>
        <Suspense fallback={null}>
          <ModeBadges />
        </Suspense>
      </header>
      <Demo />
    </main>
  );
}
