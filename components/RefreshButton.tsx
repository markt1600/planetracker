"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export default function RefreshButton({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button className="btn btn-ghost" disabled={pending} onClick={() => start(() => router.refresh())}>
      <span aria-hidden className={pending ? "animate-spin" : ""}>↻</span> {children}
    </button>
  );
}
