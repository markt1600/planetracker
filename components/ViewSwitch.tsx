import Link from "next/link";

/** Switch between the two 3D ways of browsing the collection. */
export default function ViewSwitch({ current }: { current: "airport" | "museum" }) {
  const views = [
    { id: "airport", label: "Changi airport" },
    { id: "museum", label: "Museum hall" },
  ] as const;
  return (
    <div className="flex rounded-full border border-line p-0.5 text-sm" role="group" aria-label="3D view">
      {views.map((v) => (
        <Link key={v.id} href={`/${v.id}`} aria-current={current === v.id ? "page" : undefined} className={`rounded-full px-3.5 py-1.5 ${current === v.id ? "bg-raised text-ink" : "text-mute hover:text-ink"}`}>
          {v.label}
        </Link>
      ))}
    </div>
  );
}
