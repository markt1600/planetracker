"use client";

import { useState } from "react";
import { PlaneMark } from "./Nav";

/** Photo on a light "studio" backdrop. Tries each source in turn and falls back to a silhouette. */
export default function PlaneImage({ sources, alt, className = "", fit = "contain" }: { sources: (string | undefined | null)[]; alt: string; className?: string; fit?: "contain" | "cover" }) {
  const list = sources.filter(Boolean) as string[];
  const [state, setState] = useState({ key: list.join("|"), index: 0 });
  const index = state.key === list.join("|") ? state.index : 0;
  const src = list[index];
  return (
    <div className={`studio relative overflow-hidden ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setState({ key: list.join("|"), index: index + 1 })} className={`h-full w-full ${fit === "cover" ? "object-cover" : "object-contain"}`} />
      ) : (
        <div className="grid h-full w-full place-items-center">
          <PlaneMark className="w-1/2 text-slate-300" />
        </div>
      )}
    </div>
  );
}
