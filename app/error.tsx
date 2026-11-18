"use client";

/** Shown instead of a blank error when a page can't load, most often because storage is unreachable. */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="panel mx-auto mt-10 max-w-xl p-8 text-center">
      <p className="label !text-bad">Grounded</p>
      <h1 className="mt-2 font-display text-3xl">This page couldn&rsquo;t load</h1>
      <p className="mt-3 text-mute">The site couldn&rsquo;t read the saved collection just now. Nothing has been deleted — try again in a moment.</p>
      <div className="mt-6 flex justify-center gap-3">
        <button className="btn btn-primary" onClick={() => retry()}>Try again</button>
        <a className="btn btn-ghost" href="/api/health" target="_blank" rel="noreferrer">Check storage</a>
      </div>
      {error.digest && <p className="mt-4 font-mono text-xs text-faint">Reference {error.digest}</p>}
    </div>
  );
}
