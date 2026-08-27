"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PasswordField } from "./password-field";
import { useUpdateBlocker } from "@/lib/use-update-blocker";
import { UPDATE_BLOCKER_IDS, UPDATE_BLOCKER_REASONS } from "@/lib/update-blocker-reasons";

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
  const configHint = params.get("e") === "config";
  useUpdateBlocker(busy, UPDATE_BLOCKER_IDS.login, UPDATE_BLOCKER_REASONS.login);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
        cache: "no-store",
      });
      // Clear password from memory ASAP — never persist client-side
      setPassword("");
      if (!res.ok) {
        if (res.status === 429) {
          setError("Trop de tentatives. Réessayez plus tard.");
        } else if (res.status === 503) {
          setError("Connexion temporairement indisponible.");
        } else {
          setError("Connexion refusée.");
        }
        setBusy(false);
        return;
      }
      const nextRaw = params.get("next") || params.get("from") || "/";
      const next =
        nextRaw.startsWith("/") && !nextRaw.startsWith("//") && !nextRaw.includes("\\")
          ? nextRaw
          : "/";
      window.location.assign(next);
    } catch {
      setPassword("");
      setError("Connexion refusée.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 safe-x bg-[var(--background)]">
      <form
        onSubmit={submit}
        className="card w-full max-w-sm p-6 space-y-4"
        style={{ animation: "fadeIn 0.25s ease" }}
        autoComplete="on"
      >
        <div>
          <div className="text-xl font-bold tracking-tight">
            Virtual Humans <span className="text-[var(--accent)]">Studio</span>
          </div>
          <p className="text-sm text-[var(--muted)] mt-1">
            Accès protégé — saisissez le mot de passe partagé.
          </p>
        </div>

        {configHint && (
          <p className="text-sm text-[var(--muted)]" role="status">
            Configuration d&apos;accès indisponible. Vérifiez les variables serveur locales
            (sans les exposer).
          </p>
        )}

        <PasswordField
          id="pw"
          value={password}
          onChange={setPassword}
          disabled={busy}
          autoFocus
        />

        {error && (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={busy || !password}
          aria-busy={busy}
        >
          {busy ? "Connexion…" : "Entrer"}
        </button>
      </form>
    </div>
  );
}
