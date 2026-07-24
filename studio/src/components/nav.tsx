"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { apiGet, usd } from "@/lib/client";
import { useCharacter } from "@/lib/character-context";
import { useConfirm } from "@/components/confirm";
import type { SettingsResponse } from "@/lib/types";

const LINKS = [
  { href: "/", label: "Tableau de bord", icon: "◧" },
  { href: "/characters", label: "Personnages", icon: "☺" },
  { href: "/scene", label: "Studio Scène", icon: "◈" },
  { href: "/products", label: "Produits / Apps", icon: "▦" },
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
  const [open, setOpen] = useState(false);
  const [access, setAccess] = useState<SettingsResponse["access"] | null>(null);
  const { characters, characterId, setCharacterId } = useCharacter();
  const confirm = useConfirm();

  useEffect(() => {
    const load = () =>
      apiGet<{ total: number }>("/api/budget")
        .then((d) => setTotal(d.total))
        .catch(() => setTotal(null));
    load();
    window.addEventListener("budget:refresh", load);
    return () => window.removeEventListener("budget:refresh", load);
  }, []);

  useEffect(() => {
    apiGet<SettingsResponse>("/api/settings")
      .then((s) => setAccess(s.access))
      .catch(() => setAccess(null));
  }, []);

  // Ferme le tiroir mobile à chaque changement de page.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Bloque le défilement de la page tant que le tiroir mobile est ouvert.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function resetBudget() {
    const ok = await confirm({
      title: "Réinitialiser la dépense",
      message: "Remettre le cumul des dépenses estimées à zéro ?\nUtile en début de campagne.",
      confirmLabel: "Réinitialiser",
    });
    if (!ok) return;
    try {
      await fetch("/api/budget", { method: "DELETE" });
      setTotal(0);
      window.dispatchEvent(new Event("budget:refresh"));
    } catch {
      /* ignore */
    }
  }

  async function logout() {
    try {
      await fetch("/api/login", { method: "DELETE" });
    } catch {
      /* ignore */
    }
    window.location.assign("/login");
  }

  const cap = access?.budgetCapUSD ?? null;
  const ratio = cap && total != null ? total / cap : 0;
  const budgetTone =
    ratio >= 1 ? "text-[var(--danger)]" : ratio >= 0.8 ? "text-[#f59e0b]" : "";

  const characterPicker = (
    <div className="px-2">
      <label className="label mb-1 block">Personnage actif</label>
      <select
        className="select"
        value={characterId}
        onChange={(e) => setCharacterId(e.target.value)}
        disabled={characters.length === 0}
      >
        {characters.length === 0 && <option value="">…</option>}
        {characters.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );

  const navLinks = (
    <nav className="flex flex-col gap-1">
      {LINKS.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`nav-link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
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
  );

  const budgetCard = (
    <div className="mt-auto card p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="label">Dépense estimée</div>
        <button
          type="button"
          onClick={resetBudget}
          title="Remettre le cumul à zéro (par campagne)"
          className="text-xs text-[var(--muted)] hover:text-[var(--danger)] transition-colors"
        >
          reset
        </button>
      </div>
      <div className={`text-2xl font-bold tabular-nums ${budgetTone}`}>{usd(total)}</div>
      {cap != null && (
        <div className="text-xs text-[var(--muted)] mt-0.5">
          {ratio >= 1 ? "⚠ plafond atteint" : "plafond"} : {usd(cap)}
        </div>
      )}
      <Link href="/budget" className="text-xs text-[var(--accent-2)] hover:underline">
        Voir le détail →
      </Link>
      {access?.protected && (
        <button
          type="button"
          onClick={logout}
          className="mt-3 w-full text-xs text-[var(--muted)] hover:text-[var(--danger)] transition-colors text-left"
        >
          ⏻ Déconnexion
        </button>
      )}
    </div>
  );

  const brand = (
    <div className="px-2">
      <div className="text-lg font-bold tracking-tight">
        Virtual Humans <span className="text-[var(--accent)]">Studio</span>
      </div>
      <div className="text-xs text-[var(--muted)] mt-1">Génération multi-fournisseurs</div>
    </div>
  );

  return (
    <>
      {/* Barre supérieure — mobile uniquement */}
      <header
        className="md:hidden sticky top-0 z-30 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_88%,transparent)] backdrop-blur safe-t safe-x"
      >
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            type="button"
            aria-label="Ouvrir le menu"
            onClick={() => setOpen(true)}
            className="btn btn-ghost !px-3 !py-2 text-lg leading-none"
          >
            ☰
          </button>
          <Link href="/" className="text-base font-bold tracking-tight truncate">
            Virtual Humans <span className="text-[var(--accent)]">Studio</span>
          </Link>
          <Link
            href="/budget"
            className="ml-auto text-sm font-bold tabular-nums text-[var(--accent-2)]"
            title="Dépense estimée"
          >
            {usd(total)}
          </Link>
        </div>
      </header>

      {/* Sidebar — desktop uniquement */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_70%,transparent)] px-4 py-6 flex-col gap-6 sticky top-0 h-screen">
        {brand}
        {characterPicker}
        {navLinks}
        {budgetCard}
      </aside>

      {/* Tiroir — mobile uniquement */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="absolute left-0 top-0 h-full w-72 max-w-[85vw] flex flex-col gap-5 overflow-y-auto border-r border-[var(--border)] bg-[var(--surface)] px-4 py-5 safe-t safe-b safe-x"
            style={{ animation: "slideInLeft 0.2s ease" }}
          >
            <div className="flex items-start justify-between gap-2">
              {brand}
              <button
                type="button"
                aria-label="Fermer le menu"
                onClick={() => setOpen(false)}
                className="btn btn-ghost !px-3 !py-2 text-lg leading-none"
              >
                ✕
              </button>
            </div>
            {characterPicker}
            {navLinks}
            {budgetCard}
          </aside>
        </div>
      )}
    </>
  );
}
