"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";

interface Level {
  raw: string | null;
  value: number | null;
}
interface DataQualityIssue {
  code: string;
  severity: "error" | "warning" | "info";
  field: string;
  message: string;
}
interface AssetItem {
  category: string;
  name: string;
  relPath: string;
}
interface Outfit {
  id: string;
  name: string;
  lookPath: string;
}
interface DocumentRef {
  present: boolean;
  source: string;
  title: string | null;
  sectionCount: number;
}
interface CharacterPackage {
  characterId: string;
  characterCode: string | null;
  directoryName: string;
  displayName: string;
  sdkVersion: string | null;
  characterVersion: string | null;
  status: string | null;
  identity: {
    present: boolean;
    source: string;
    name: string | null;
    role: string | null;
    coreValues: string[];
    languages: { primary: string | null; secondary: string | null };
  };
  appearance: DocumentRef;
  personality: {
    source: string;
    personalityVersion: string | null;
    coreIdentitySentence: string | null;
    levels: { warmth: Level; energy: Level; formality: Level; humor: Level };
    coreTraits: string[];
    communicationStyle: string[];
    primaryTraits: string[];
    secondaryTraits: string[];
    prohibitedTraits: string[];
    greetings: string[];
    conclusions: string[];
    ctaPreferred: string[];
    ctaAvoided: string[];
    formOfAddress: string | null;
    language: string | null;
  };
  voice: { present: boolean; source: string; config: { voiceName?: string; model?: string; language?: string } | null };
  outfits: Outfit[];
  poses: AssetItem[];
  expressions: AssetItem[];
  identityReferences: AssetItem[];
  memories: { file: string; title: string | null; present: boolean }[];
  capabilities: DocumentRef;
  limitations: DocumentRef;
  dataQuality: DataQualityIssue[];
  loadedAt: string;
}

interface ConflictPkg {
  directoryName: string;
  version: string | null;
  characterId: string;
  characterCode: string | null;
}
interface ApiError {
  code: string;
  message: string;
  details?: { characterId?: string; characterCode?: string; packages?: ConflictPkg[] };
}

export default function CharacterDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [pkg, setPkg] = useState<CharacterPackage | null>(null);
  const [apiError, setApiError] = useState<{ status: number; error: ApiError } | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/v1/characters/${encodeURIComponent(id)}`, { cache: "no-store" });
      const json = await res.json();
      if (cancelled) return;
      if (res.ok) {
        setPkg(json.character as CharacterPackage);
      } else {
        setApiError({ status: res.status, error: json.error as ApiError });
      }
    })().catch((e) => {
      if (!cancelled) setApiError({ status: 0, error: { code: "NETWORK", message: String(e) } });
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (apiError) {
    const isConflict = apiError.status === 409;
    return (
      <div>
        <Link href="/characters" className="text-sm text-[var(--accent-2)] hover:underline">
          ← Personnages
        </Link>
        <PageHeader
          title={isConflict ? "Collision d'identifiant (409)" : "Personnage indisponible"}
          subtitle={apiError.error.code}
        />
        <div className="card p-4" style={{ borderColor: "var(--danger)" }}>
          <div className="text-sm text-[var(--danger)]">{apiError.error.message}</div>
          {apiError.error.details?.packages && (
            <ul className="mt-3 ml-4 list-disc text-sm text-[var(--muted)]">
              {apiError.error.details.packages.map((p) => (
                <li key={p.directoryName}>
                  <span className="font-mono">{p.directoryName}</span> — v{p.version ?? "?"} · id{" "}
                  <span className="font-mono">{p.characterId}</span> · code{" "}
                  <span className="font-mono">{p.characterCode ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
          {isConflict && (
            <div className="mt-3 text-xs text-[var(--muted)]">
              Le registre refuse de résoudre un identifiant ambigu. Corrigez le doublon (renommez
              le personnage et fixez un characterId/characterCode unique) pour rétablir l&apos;accès.
            </div>
          )}
        </div>
      </div>
    );
  }
  if (!pkg) return <div className="text-sm text-[var(--muted)]">Chargement…</div>;

  const p = pkg.personality;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/characters" className="text-sm text-[var(--accent-2)] hover:underline">
          ← Personnages
        </Link>
      </div>
      <PageHeader
        title={pkg.displayName}
        subtitle={`${pkg.directoryName} · SDK ${pkg.sdkVersion ?? "?"} · ${pkg.status ?? "—"}`}
      />

      <DataQuality issues={pkg.dataQuality} />

      <Section title="Identité" ok={pkg.identity.present} source={pkg.identity.source}>
        <Field label="Nom" value={pkg.identity.name} />
        <Field label="characterId (technique)" value={pkg.characterId} />
        <Field label="characterCode (métier)" value={pkg.characterCode} />
        <Field label="Version personnage" value={pkg.characterVersion} />
        <Field label="Rôle" value={pkg.identity.role} />
        <Field
          label="Langues"
          value={[pkg.identity.languages.primary, pkg.identity.languages.secondary]
            .filter(Boolean)
            .join(" · ")}
        />
        <Chips label="Valeurs" items={pkg.identity.coreValues} />
      </Section>

      <Section title="Personnalité (structurée)" ok source={p.source}>
        <Field label="Phrase d'identité" value={p.coreIdentitySentence} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-3">
          <LevelBar label="Chaleur" level={p.levels.warmth} />
          <LevelBar label="Énergie" level={p.levels.energy} />
          <LevelBar label="Formalité" level={p.levels.formality} />
          <LevelBar label="Humour" level={p.levels.humor} />
        </div>
        <Chips label="Traits primaires (verrouillés)" items={p.primaryTraits} />
        <Chips label="Traits secondaires (contrôlés)" items={p.secondaryTraits} />
        <Chips label="Traits interdits" items={p.prohibitedTraits} danger />
        <Field label="Forme d'adresse" value={p.formOfAddress} />
      </Section>

      <Section title="Phrases (candidats)" ok source={p.source}>
        <PhraseList label="Salutations" items={p.greetings} />
        <PhraseList label="Conclusions" items={p.conclusions} />
        <PhraseList label="Appels à l'action préférés" items={p.ctaPreferred} />
        <PhraseList label="Appels à l'action à éviter" items={p.ctaAvoided} danger />
      </Section>

      <Section title="Assets" ok={pkg.outfits.length > 0}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Count label="Tenues" n={pkg.outfits.length} />
          <Count label="Réf. identité" n={pkg.identityReferences.length} />
          <Count label="Poses" n={pkg.poses.length} />
          <Count label="Expressions" n={pkg.expressions.length} />
        </div>
        {pkg.outfits.length > 0 && (
          <div className="mt-3 text-xs text-[var(--muted)]">
            {pkg.outfits.map((o) => o.name).join(" · ")}
          </div>
        )}
      </Section>

      <Section title="Voix" ok={pkg.voice.present} source={pkg.voice.source}>
        <Field label="Voix" value={pkg.voice.config?.voiceName ?? null} />
        <Field label="Modèle" value={pkg.voice.config?.model ?? null} />
        <Field label="Langue" value={pkg.voice.config?.language ?? null} />
      </Section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Capacités" ok={pkg.capabilities.present} source={pkg.capabilities.source}>
          <Field label="Titre" value={pkg.capabilities.title} />
          <Field label="Sections" value={String(pkg.capabilities.sectionCount)} />
        </Section>
        <Section title="Limitations" ok={pkg.limitations.present} source={pkg.limitations.source}>
          <Field label="Titre" value={pkg.limitations.title} />
          <Field label="Sections" value={String(pkg.limitations.sectionCount)} />
        </Section>
      </div>

      <Section title="Mémoires" ok={pkg.memories.some((m) => m.present)}>
        <div className="grid gap-1">
          {pkg.memories.map((m) => (
            <div key={m.file} className="flex items-center gap-2 text-sm">
              <span style={{ color: m.present ? "var(--success)" : "var(--danger)" }}>
                {m.present ? "✓" : "✗"}
              </span>
              <span className="font-mono text-xs">{m.file}</span>
              {m.title && <span className="text-[var(--muted)] text-xs">— {m.title}</span>}
            </div>
          ))}
        </div>
      </Section>

      <div className="text-xs text-[var(--muted)]">Chargé le {new Date(pkg.loadedAt).toLocaleString("fr-FR")}</div>
    </div>
  );
}

function DataQuality({ issues }: { issues: DataQualityIssue[] }) {
  if (issues.length === 0) {
    return (
      <div className="card p-4 text-sm" style={{ borderColor: "var(--success)" }}>
        Aucun problème de qualité de données détecté.
      </div>
    );
  }
  const color = (s: DataQualityIssue["severity"]) =>
    s === "error" ? "var(--danger)" : s === "warning" ? "#f59e0b" : "var(--accent-2)";
  return (
    <div className="card p-4">
      <div className="label mb-2">Qualité des données ({issues.length})</div>
      <div className="grid gap-2">
        {issues.map((i, idx) => (
          <div key={idx} className="flex items-start gap-2 text-sm">
            <span className="badge shrink-0" style={{ borderColor: color(i.severity), color: color(i.severity) }}>
              {i.severity}
            </span>
            <div>
              <span className="font-mono text-xs text-[var(--muted)]">{i.field}</span>
              <div>{i.message}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({
  title,
  ok,
  source,
  children,
}: {
  title: string;
  ok: boolean;
  source?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold flex items-center gap-2">
          <span style={{ color: ok ? "var(--success)" : "var(--danger)" }}>{ok ? "●" : "○"}</span>
          {title}
        </h2>
        {source && <span className="font-mono text-xs text-[var(--muted)]">{source}</span>}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="text-[var(--muted)] w-40 shrink-0">{label}</span>
      <span className={value ? "" : "text-[var(--muted)] italic"}>{value || "—"}</span>
    </div>
  );
}

function Chips({ label, items, danger }: { label: string; items: string[]; danger?: boolean }) {
  return (
    <div className="text-sm">
      <div className="text-[var(--muted)] mb-1">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 && <span className="text-[var(--muted)] italic">—</span>}
        {items.map((it, i) => (
          <span
            key={i}
            className="badge"
            style={danger ? { borderColor: "var(--danger)", color: "var(--danger)" } : undefined}
          >
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}

function PhraseList({ label, items, danger }: { label: string; items: string[]; danger?: boolean }) {
  return (
    <div className="text-sm">
      <div className="text-[var(--muted)] mb-1">
        {label} ({items.length})
      </div>
      <ul className="space-y-1">
        {items.length === 0 && <li className="text-[var(--muted)] italic">—</li>}
        {items.map((it, i) => (
          <li key={i} style={danger ? { color: "var(--danger)" } : undefined}>
            « {it} »
          </li>
        ))}
      </ul>
    </div>
  );
}

function LevelBar({ label, level }: { label: string; level: Level }) {
  const pct = level.value == null ? 0 : Math.round(level.value * 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[var(--muted)]">{label}</span>
        <span>{level.raw ?? "—"}</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
        <div className="h-full" style={{ width: `${pct}%`, background: "var(--accent)" }} />
      </div>
    </div>
  );
}

function Count({ label, n }: { label: string; n: number }) {
  return (
    <div className="rounded-lg bg-[var(--surface-2)] p-3 text-center">
      <div className="text-2xl font-bold tabular-nums">{n}</div>
      <div className="text-xs text-[var(--muted)]">{label}</div>
    </div>
  );
}
