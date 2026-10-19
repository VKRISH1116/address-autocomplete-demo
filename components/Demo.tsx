"use client";

import { useState } from "react";
import { AddressForm, type SavedAddress } from "@/components/AddressForm";

export function Demo() {
  const [saved, setSaved] = useState<SavedAddress[]>([]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="flex flex-col gap-6">
        <AddressForm
          title="New client"
          party="client"
          onSaved={(s) => setSaved((list) => [s, ...list].slice(0, 5))}
        />
        <AddressForm
          title="New vendor"
          party="vendor"
          onSaved={(s) => setSaved((list) => [s, ...list].slice(0, 5))}
        />
      </div>
      <aside className="h-fit rounded-xl border border-zinc-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
        <h2 className="text-lg font-semibold text-zinc-900">Saved payload</h2>
        <p className="mt-1 text-sm text-zinc-600">
          What a backend would receive when you press Save (newest first). Nothing is stored.
        </p>
        {saved.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">Nothing saved yet.</p>
        ) : (
          <pre className="mt-4 max-h-[32rem] overflow-auto rounded-md bg-zinc-900 p-3 text-xs leading-relaxed text-zinc-100">
            {JSON.stringify(saved, null, 2)}
          </pre>
        )}
      </aside>
    </div>
  );
}
