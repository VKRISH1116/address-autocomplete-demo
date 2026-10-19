"use client";

import { useEffect, useRef, useState } from "react";
import {
  ComboBox,
  FieldError,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Text,
  type Key,
} from "react-aria-components";
import type { AddressDraft } from "@/lib/address";
import type { Suggestion } from "@/lib/providers/types";

type Props = {
  label: string;
  /** The street text shown in the box (the form's line1). */
  value: string;
  onTextChange: (text: string) => void;
  /** Called with all address parts after a suggestion is picked. */
  onPick: (address: AddressDraft) => void;
  errorMessage?: string;
  hint?: string;
};

const MIN_CHARS = 3;
const DEBOUNCE_MS = 250;

function newSessionToken(): string {
  return crypto.randomUUID();
}

/**
 * The street box: free typing is always allowed; after 3 characters it asks
 * the server for suggestions. Picking one fills every address field.
 */
export function AddressAutocomplete({
  label,
  value,
  onTextChange,
  onPick,
  errorMessage,
  hint,
}: Props) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<string>("");
  const [problem, setProblem] = useState<string | null>(null);
  // Only offer the "no matches" message while the user is typing a search,
  // not right after they picked a suggestion.
  const [searching, setSearching] = useState(false);

  // One session token per search; Google bills the whole search as one
  // session when it ends with a details call using the same token.
  const session = useRef<string>("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  // Picking an item also changes the input text; don't search for that text.
  const justPicked = useRef(false);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      inFlight.current?.abort();
    },
    [],
  );

  function search(text: string) {
    if (timer.current) clearTimeout(timer.current);
    inFlight.current?.abort();
    if (text.trim().length < MIN_CHARS) {
      setItems([]);
      setLoading(false);
      return;
    }
    if (!session.current) session.current = newSessionToken();
    setLoading(true);
    timer.current = setTimeout(async () => {
      const ctrl = new AbortController();
      inFlight.current = ctrl;
      try {
        const res = await fetch(
          `/api/address/autocomplete?q=${encodeURIComponent(text)}&session=${session.current}`,
          { signal: ctrl.signal },
        );
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Suggestions are unavailable.");
        setItems(body.suggestions);
        setProvider(body.provider);
        setProblem(null);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setItems([]);
        setProblem((e as Error).message);
      } finally {
        if (inFlight.current === ctrl) setLoading(false);
      }
    }, DEBOUNCE_MS);
  }

  function handleInput(text: string) {
    onTextChange(text);
    if (justPicked.current) {
      justPicked.current = false;
      return;
    }
    setSearching(true);
    search(text);
  }

  async function handlePick(key: Key | null) {
    if (key === null) return;
    justPicked.current = true;
    const token = session.current || newSessionToken();
    session.current = ""; // the next search starts a new session
    setSearching(false);
    setItems([]);
    try {
      const res = await fetch(
        `/api/address/details?id=${encodeURIComponent(String(key))}&session=${token}`,
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not load that address.");
      onPick(body.address as AddressDraft);
      setProblem(null);
    } catch (e) {
      setProblem((e as Error).message);
    }
  }

  const showEmpty = searching && value.trim().length >= MIN_CHARS;

  return (
    <ComboBox
      className="flex flex-col gap-1"
      allowsCustomValue
      allowsEmptyCollection={showEmpty}
      menuTrigger="input"
      inputValue={value}
      onInputChange={handleInput}
      items={items}
      value={null}
      onChange={handlePick}
      // The server already filtered; show every suggestion it returned.
      defaultFilter={() => true}
      isInvalid={Boolean(errorMessage)}
    >
      <Label className="text-sm font-medium text-zinc-800">{label}</Label>
      <Input
        className="h-10 rounded-md border border-zinc-400 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/30 data-[invalid]:border-red-600"
        placeholder="Start typing, e.g. 100 Congress Ave"
        autoComplete="off"
      />
      {hint && !errorMessage && !problem && (
        <Text slot="description" className="text-xs text-zinc-600">
          {hint}
        </Text>
      )}
      {problem && (
        <Text slot="description" className="text-xs text-amber-800" role="status">
          {problem} You can still type the address by hand.
        </Text>
      )}
      <FieldError className="text-xs text-red-700">{errorMessage}</FieldError>
      <Popover
        className="w-[var(--trigger-width)] overflow-hidden rounded-md border border-zinc-300 bg-white shadow-lg"
        offset={4}
      >
        <ListBox
          className="max-h-72 overflow-auto p-1 outline-none"
          renderEmptyState={() => (
            <p className="px-3 py-2 text-sm text-zinc-600">
              {loading ? "Searching…" : "No matching addresses. Keep typing or enter it by hand."}
            </p>
          )}
        >
          {(item: Suggestion) => (
            <ListBoxItem
              id={item.id}
              textValue={item.main}
              className="flex cursor-pointer flex-col rounded px-3 py-2 text-sm outline-none data-[focused]:bg-blue-50 data-[focused]:text-blue-900"
            >
              <span className="font-medium text-zinc-900">{item.main}</span>
              <span className="text-xs text-zinc-600">{item.secondary}</span>
            </ListBoxItem>
          )}
        </ListBox>
        {provider === "google" && (
          // Google's terms require this when showing Places results without a map.
          <p className="border-t border-zinc-200 px-3 py-1 text-right text-[11px] text-zinc-600">
            Powered by Google
          </p>
        )}
        {provider === "mock" && (
          <p className="border-t border-zinc-200 px-3 py-1 text-right text-[11px] text-zinc-600">
            Demo data (no API key)
          </p>
        )}
      </Popover>
    </ComboBox>
  );
}
