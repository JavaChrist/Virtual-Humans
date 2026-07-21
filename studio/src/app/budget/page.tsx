"use client";

import { useEffect, useState } from "react";
import { apiGet, refreshBudget, usd } from "@/lib/client";
import { PageHeader } from "@/components/page-header";

interface SpendEntry {
  id: string;
  ts: number;
  type: string;
  provider: string;
  model: string;
  estimateUSD: number;
  note?: string;
}
interface Summary {
  total: number;
  byType: Record<string, number>;
  count: number;
  entries: SpendEntry[];
}

export default function BudgetPage() {
  const [data, setData] = useState<Summary | null>(null);

  const load = () => apiGet<Summary>("/api/budget").then(setData).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  async function reset() {
    await fetch("/api/budget", { method: "DELETE" });
    await load();
    refreshBudget();
  }

  return (
    <div className="max-w-4xl">
      <PageHeader title="Budget" subtitle="Estimation cumulée des dépenses de génération (indicative)" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card p-5">
          <div className="label">Total</div>
          <div className="text-3xl font-bold tabular-nums mt-1">{usd(data?.total)}</div>
        </div>
        {["image", "voice", "video"].map((t) => (
          <div key={t} className="card p-5">
            <div className="label">{t}</div>
            <div className="text-2xl font-bold tabular-nums mt-1">{usd(data?.byType[t] ?? 0)}</div>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Historique ({data?.count ?? 0})</h3>
          <button className="btn btn-ghost" onClick={reset}>
            Réinitialiser
          </button>
        </div>

        {data && data.entries.length === 0 && (
          <p className="text-sm text-[var(--muted)]">Aucune génération pour l&apos;instant.</p>
        )}

        <div className="flex flex-col gap-2">
          {data?.entries.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-4 py-2 text-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="badge">{e.type}</span>
                <span className="text-[var(--muted)] truncate">{e.model}</span>
                {e.note && <span className="text-xs text-[var(--muted)] truncate">· {e.note}</span>}
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="text-xs text-[var(--muted)]">{new Date(e.ts).toLocaleString()}</span>
                <span className="font-semibold tabular-nums">{usd(e.estimateUSD)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-[var(--muted)] mt-4">
        Les montants sont des estimations basées sur des tarifs publics approximatifs et peuvent différer de la
        facturation réelle des fournisseurs. Ajuste les tarifs via les variables d&apos;environnement.
      </p>
    </div>
  );
}
