"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { apiGet, usd } from "@/lib/client";

const LINKS = [
  { href: "/", label: "Tableau de bord", icon: "◧" },
  { href: "/image", label: "Studio Image", icon: "▣" },
  { href: "/voice", label: "Studio Voix", icon: "◉" },
  { href: "/video", label: "Studio Vidéo", icon: "►" },
  { href: "/lipsync", label: "Studio Lip-sync", icon: "◑" },
  { href: "/storyboard", label: "Storyboard 60s", icon: "▤" },
  { href: "/budget", label: "Budget", icon: "$" },
  { href: "/settings", label: "Réglages", icon: "⚙" },
];

export function Nav() {
  const pathname = usePathname();
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    const load = () =>
      apiGet<{ total: number }>("/api/budget")
        .then((d) => setTotal(d.total))
        .catch(() => setTotal(null));
    load();
    window.addEventListener("budget:refresh", load);
    return () => window.removeEventListener("budget:refresh", load);
  }, []);

  return (
    <aside className="w-64 shrink-0 border-r border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_70%,transparent)] px-4 py-6 flex flex-col gap-6 sticky top-0 h-screen">
      <div className="px-2">
        <div className="text-lg font-bold tracking-tight">
          Virtual Humans <span className="text-[var(--accent)]">Studio</span>
        </div>
        <div className="text-xs text-[var(--muted)] mt-1">Génération multi-fournisseurs</div>
      </div>

      <nav className="flex flex-col gap-1">
        {LINKS.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-[var(--surface-2)] text-white border border-[var(--border)]"
                  : "text-[var(--muted)] hover:text-white hover:bg-[var(--surface-2)]"
              }`}
            >
              <span className="w-5 text-center text-[var(--accent-2)]">{l.icon}</span>
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto card p-4">
        <div className="label mb-1">Dépense estimée</div>
        <div className="text-2xl font-bold tabular-nums">{usd(total)}</div>
        <Link href="/budget" className="text-xs text-[var(--accent-2)] hover:underline">
          Voir le détail →
        </Link>
      </div>
    </aside>
  );
}
