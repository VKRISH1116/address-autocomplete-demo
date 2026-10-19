"use client";

import { useId, useState } from "react";
import {
  Button,
  Dialog,
  FieldError,
  Heading,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Modal,
  ModalOverlay,
  Popover,
  Select,
  SelectValue,
  Text,
  TextField,
} from "react-aria-components";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import {
  BLANK_ADDRESS,
  changedFields,
  checkAddress,
  isEmptyAddress,
  trimAddress,
  US_STATES,
  type AddressDraft,
  type AddressErrors,
} from "@/lib/address";
import type { ValidationResult } from "@/lib/providers/types";

export type SavedAddress = {
  party: string;
  kind: "BILLING";
  address: (Omit<AddressDraft, "line2"> & { line2: string | null }) | null;
  checkedBy: string | null;
  verdict: ValidationResult["verdict"] | "not-checked";
};

type Props = {
  title: string;
  party: string;
  onSaved: (saved: SavedAddress) => void;
};

const inputClass =
  "h-10 rounded-md border border-zinc-400 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/30 data-[invalid]:border-red-600";
const labelClass = "text-sm font-medium text-zinc-800";
const errorClass = "text-xs text-red-700";

const FIELD_LABELS: Record<keyof AddressDraft, string> = {
  line1: "Street address",
  line2: "Address line 2",
  city: "City",
  state: "State",
  postalCode: "ZIP code",
  country: "Country",
};

export function AddressForm({ title, party, onSaved }: Props) {
  const [draft, setDraft] = useState<AddressDraft>(BLANK_ADDRESS);
  const [errors, setErrors] = useState<AddressErrors>({});
  const [checking, setChecking] = useState(false);
  const [checkProblem, setCheckProblem] = useState<string | null>(null);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const formErrorId = useId();

  const set = (field: keyof AddressDraft) => (v: string) => {
    setDraft((d) => ({ ...d, [field]: v }));
    setErrors((e) => ({ ...e, [field]: undefined, form: undefined }));
    setSavedNote(null);
  };

  function finish(address: AddressDraft | null, checkedBy: string | null, verdict: SavedAddress["verdict"]) {
    onSaved({
      party,
      kind: "BILLING",
      address: address ? { ...address, line2: address.line2 || null } : null,
      checkedBy,
      verdict,
    });
    if (address) setDraft(address);
    setResult(null);
    setSavedNote(address ? "Saved." : "Saved with no address.");
  }

  async function save() {
    setCheckProblem(null);
    const found = checkAddress(draft);
    setErrors(found);
    if (Object.keys(found).length) return;

    const typed = trimAddress(draft);
    if (isEmptyAddress(typed)) return finish(null, null, "not-checked");

    setChecking(true);
    try {
      const res = await fetch("/api/address/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(typed),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "The address check is unavailable.");
      const r = body as ValidationResult;
      const differs = r.standardized && changedFields(typed, r.standardized).length > 0;
      if (differs || r.verdict !== "valid") {
        setResult(r); // ask the user
      } else {
        finish(typed, r.source, r.verdict);
      }
    } catch (e) {
      // The check is a helper, not a gate: let people save anyway.
      setCheckProblem(`${(e as Error).message} The address was not checked.`);
    } finally {
      setChecking(false);
    }
  }

  const typedNow = trimAddress(draft);
  const changed = result?.standardized ? changedFields(typedNow, result.standardized) : [];

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Billing address. Optional, but if you fill one part, fill street, city, state and ZIP.
      </p>

      <form
        className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-6"
        noValidate
        aria-describedby={errors.form ? formErrorId : undefined}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="sm:col-span-6">
          <AddressAutocomplete
            label={FIELD_LABELS.line1}
            value={draft.line1}
            onTextChange={set("line1")}
            onPick={(a) => {
              setDraft(a);
              setErrors({});
              setSavedNote(null);
            }}
            errorMessage={errors.line1}
            hint="Pick a suggestion to fill the rest, or type it all by hand."
          />
        </div>

        <TextField className="flex flex-col gap-1 sm:col-span-6" value={draft.line2} onChange={set("line2")}>
          <Label className={labelClass}>{FIELD_LABELS.line2}</Label>
          <Input className={inputClass} placeholder="Suite, unit, floor (optional)" />
        </TextField>

        <TextField
          className="flex flex-col gap-1 sm:col-span-3"
          value={draft.city}
          onChange={set("city")}
          isInvalid={Boolean(errors.city)}
        >
          <Label className={labelClass}>{FIELD_LABELS.city}</Label>
          <Input className={inputClass} />
          <FieldError className={errorClass}>{errors.city}</FieldError>
        </TextField>

        <Select
          className="flex flex-col gap-1 sm:col-span-2"
          value={draft.state || null}
          onChange={(k) => set("state")(k ? String(k) : "")}
          isInvalid={Boolean(errors.state)}
          placeholder="Choose…"
        >
          <Label className={labelClass}>{FIELD_LABELS.state}</Label>
          <Button className={`${inputClass} flex items-center justify-between text-left`}>
            <SelectValue className="truncate data-[placeholder]:text-zinc-500" />
            <span aria-hidden="true">▾</span>
          </Button>
          <FieldError className={errorClass}>{errors.state}</FieldError>
          <Popover className="w-[var(--trigger-width)] min-w-56 rounded-md border border-zinc-300 bg-white shadow-lg">
            <ListBox className="max-h-72 overflow-auto p-1 outline-none" items={US_STATES.map((s) => ({ id: s.code, ...s }))}>
              {(s) => (
                <ListBoxItem
                  id={s.code}
                  textValue={`${s.code} ${s.name}`}
                  className="cursor-pointer rounded px-3 py-1.5 text-sm outline-none data-[focused]:bg-blue-50 data-[selected]:font-semibold"
                >
                  {s.code} · {s.name}
                </ListBoxItem>
              )}
            </ListBox>
          </Popover>
        </Select>

        <TextField
          className="flex flex-col gap-1 sm:col-span-1"
          value={draft.postalCode}
          onChange={set("postalCode")}
          isInvalid={Boolean(errors.postalCode)}
        >
          <Label className={labelClass}>{FIELD_LABELS.postalCode}</Label>
          <Input className={inputClass} inputMode="numeric" placeholder="78701" />
          <FieldError className={errorClass}>{errors.postalCode}</FieldError>
        </TextField>

        <TextField className="flex flex-col gap-1 sm:col-span-2" value="United States (US)" isReadOnly>
          <Label className={labelClass}>{FIELD_LABELS.country}</Label>
          <Input className={`${inputClass} bg-zinc-100`} />
          <Text slot="description" className="text-xs text-zinc-600">
            US only in this demo.
          </Text>
        </TextField>

        <div className="flex flex-wrap items-center gap-3 sm:col-span-6">
          <Button
            type="submit"
            isPending={checking}
            className="h-10 rounded-md bg-blue-700 px-4 text-sm font-medium text-white outline-none hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600/40 focus-visible:ring-offset-2 data-[pending]:opacity-70"
          >
            {checking ? "Checking address…" : "Save"}
          </Button>
          <Button
            type="button"
            onPress={() => {
              setDraft(BLANK_ADDRESS);
              setErrors({});
              setSavedNote(null);
              setCheckProblem(null);
            }}
            className="h-10 rounded-md border border-zinc-300 px-4 text-sm text-zinc-800 outline-none hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-blue-600/40"
          >
            Clear
          </Button>
          <p aria-live="polite" className="text-sm">
            {errors.form && (
              <span id={formErrorId} className="text-red-700">
                {errors.form}
              </span>
            )}
            {savedNote && <span className="text-green-800">{savedNote}</span>}
          </p>
        </div>
        {checkProblem && (
          <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-6">
            {checkProblem}{" "}
            <Button
              className="font-medium underline outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40"
              onPress={() => finish(typedNow, null, "not-checked")}
            >
              Save without checking
            </Button>
          </div>
        )}
      </form>

      <ModalOverlay
        isOpen={result !== null}
        onOpenChange={(open) => !open && setResult(null)}
        isDismissable
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      >
        <Modal className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
          <Dialog className="outline-none">
            {result && (
              <>
                <Heading slot="title" className="text-lg font-semibold text-zinc-900">
                  {result.verdict === "invalid" ? "We couldn't find this address" : "Did you mean this address?"}
                </Heading>
                <ul className="mt-2 list-disc pl-5 text-sm text-zinc-700">
                  {result.messages.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <AddressCard heading="You entered" address={typedNow} />
                  {result.standardized && (
                    <AddressCard heading="Suggested" address={result.standardized} highlight={changed} />
                  )}
                </div>
                {changed.length > 0 && (
                  <p className="mt-2 text-xs text-zinc-600">
                    Changed: {changed.map((k) => FIELD_LABELS[k]).join(", ")}
                  </p>
                )}
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <Button
                    slot="close"
                    className="h-10 rounded-md border border-zinc-300 px-4 text-sm text-zinc-800 outline-none hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-blue-600/40"
                  >
                    Edit address
                  </Button>
                  <Button
                    onPress={() => finish(typedNow, result.source, result.verdict)}
                    className="h-10 rounded-md border border-zinc-300 px-4 text-sm text-zinc-800 outline-none hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-blue-600/40"
                  >
                    {result.verdict === "invalid" ? "Save anyway" : "Keep mine"}
                  </Button>
                  {result.standardized && (
                    <Button
                      autoFocus
                      onPress={() => finish(result.standardized!, result.source, result.verdict)}
                      className="h-10 rounded-md bg-blue-700 px-4 text-sm font-medium text-white outline-none hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600/40 focus-visible:ring-offset-2"
                    >
                      Use suggested
                    </Button>
                  )}
                </div>
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </section>
  );
}

function AddressCard({
  heading,
  address,
  highlight = [],
}: {
  heading: string;
  address: AddressDraft;
  highlight?: Array<keyof AddressDraft>;
}) {
  const mark = (k: keyof AddressDraft, text: string) =>
    highlight.includes(k) ? (
      <mark className="rounded bg-yellow-100 px-0.5 text-zinc-900">{text}</mark>
    ) : (
      text
    );
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-900">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-600">{heading}</p>
      <p>{mark("line1", address.line1)}</p>
      {address.line2 && <p>{mark("line2", address.line2)}</p>}
      <p>
        {mark("city", address.city)}, {mark("state", address.state)} {mark("postalCode", address.postalCode)}
      </p>
      <p>{mark("country", address.country)}</p>
    </div>
  );
}
