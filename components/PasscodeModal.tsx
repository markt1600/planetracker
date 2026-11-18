"use client";

import { useEffect, useRef, useState } from "react";

export default function PasscodeModal() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  useEffect(() => {
    const onAsk = (e: Event) => {
      resolver.current = (e as CustomEvent<(ok: boolean) => void>).detail;
      setValue("");
      setError("");
      setOpen(true);
    };
    window.addEventListener("pt:passcode", onAsk);
    return () => window.removeEventListener("pt:passcode", onAsk);
  }, []);

  const finish = (ok: boolean) => {
    setOpen(false);
    resolver.current?.(ok);
    resolver.current = null;
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-night/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Enter passcode">
      <form
        className="panel rise w-full max-w-sm p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const res = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passcode: value }) });
          setBusy(false);
          if (res.ok) finish(true);
          else setError("That passcode isn't right. Try again.");
        }}
      >
        <p className="label">Hangar key</p>
        <h2 className="mt-1 font-display text-2xl">Enter the passcode</h2>
        <p className="mt-2 text-sm text-mute">Only the collector can change the collection. You&rsquo;ll only be asked once on this device.</p>
        <input className="field mt-4" type="password" autoFocus autoComplete="current-password" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Passcode" />
        {error && <p className="mt-2 text-sm text-bad">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => finish(false)}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy || !value}>
            Unlock
          </button>
        </div>
      </form>
    </div>
  );
}
