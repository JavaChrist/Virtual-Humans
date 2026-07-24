"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Connexion refusée.");
        setBusy(false);
        return;
      }
      const from = params.get("from") || "/";
      // Rechargement complet pour que le middleware relise le cookie.
      window.location.assign(from);
    } catch {
      setError("Erreur réseau. Réessaie.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 safe-x bg-[var(--background)]">
      <form onSubmit={submit} className="card w-full max-w-sm p-6 space-y-4" style={{ animation: "fadeIn 0.25s ease" }}>
        <div>
          <div className="text-xl font-bold tracking-tight">
            Virtual Humans <span className="text-[var(--accent)]">Studio</span>
          </div>
          <p className="text-sm text-[var(--muted)] mt-1">Accès protégé — entre le mot de passe.</p>
        </div>

        <div>
          <label className="label" htmlFor="pw">
            Mot de passe
          </label>
          <input
            id="pw"
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
            placeholder="••••••••"
          />
        </div>

        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

        <button type="submit" className="btn btn-primary w-full" disabled={busy || !password}>
          {busy ? "Connexion…" : "Entrer"}
        </button>
      </form>
    </div>
  );
}
