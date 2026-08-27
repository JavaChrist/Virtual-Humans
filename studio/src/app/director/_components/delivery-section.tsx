"use client";
import { useEffect, useState } from "react";
import { useConfirm } from "@/components/confirm";
import { useUpdateBlocker } from "@/lib/use-update-blocker";
import { UPDATE_BLOCKER_IDS, UPDATE_BLOCKER_REASONS } from "@/lib/update-blocker-reasons";
import { shouldBlockNonDryBusy } from "@/lib/update-blocker-policy";
import type { FinalQualityReport } from "@/domain/postproduction";
import type { EvaluateQualityDryRunResult } from "@/application/directors/delivery/delivery-for-project";
import { buildMergeExportSectionView } from "./merge-export-section-view";

type DeliveryState = {
  status?: string;
  qualityReportId?: string;
  mergePlanId?: string;
  finalAssetId?: string;
  exportPackageId?: string;
  humanReviewId?: string;
  blockingCodes?: string[];
};

type MergeOutcome = {
  status?: string;
  reason?: string;
  finalAsset?: { id?: string; mimeType?: string };
  plan?: { id?: string; timeline?: unknown[] };
};

type ExportPkg = {
  id?: string;
  manifest?: {
    finalAssetId?: string;
    quality?: { status?: string; blockingCount?: number };
  };
  finalAsset?: { id?: string; mimeType?: string; sizeBytes?: number };
};

function outcomeLabel(o?: string) {
  if (!o) return "—";
  if (o === "pass") return "pass";
  if (o === "fail") return "fail";
  if (o === "unknown") return "unknown";
  if (o === "needs_review") return "revue";
  return o;
}

export function DeliverySection({ projectId }: { projectId: string }) {
  const confirm = useConfirm();
  const [qualityDry, setQualityDry] = useState<EvaluateQualityDryRunResult | null>(null);
  const [quality, setQuality] = useState<FinalQualityReport | null>(null);
  const [qualityRev, setQualityRev] = useState<number | null>(null);
  const [prRev, setPrRev] = useState<number>(0);
  const [delivery, setDelivery] = useState<DeliveryState | null>(null);
  const [mergeOutcome, setMergeOutcome] = useState<MergeOutcome | null>(null);
  const [mergeReady, setMergeReady] = useState(false);
  const [executeMergeReady, setExecuteMergeReady] = useState(false);
  const [mergeBlockReason, setMergeBlockReason] = useState<string | null>(null);
  const [exportPkg, setExportPkg] = useState<ExportPkg | null>(null);
  const [exportReady, setExportReady] = useState(false);
  const [exportBlockReason, setExportBlockReason] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useUpdateBlocker(
    shouldBlockNonDryBusy(busy, ["qc-dry"]),
    UPDATE_BLOCKER_IDS.directorDelivery,
    UPDATE_BLOCKER_REASONS.saving,
  );

  async function refresh() {
    try {
      const [qRes, mRes, eRes] = await Promise.all([
        fetch(`/api/director/projects/${projectId}/quality`),
        fetch(`/api/director/projects/${projectId}/merge`),
        fetch(`/api/director/projects/${projectId}/export`),
      ]);
      if (qRes.ok) {
        const data = (await qRes.json()) as {
          dryRun?: EvaluateQualityDryRunResult;
          quality?: FinalQualityReport | null;
          qualityReportRevision?: number | null;
          productionResultRevision?: number;
          delivery?: DeliveryState | null;
          error?: string;
        };
        if (data.dryRun) setQualityDry(data.dryRun);
        if (data.quality) setQuality(data.quality);
        setQualityRev(data.qualityReportRevision ?? null);
        setPrRev(data.productionResultRevision ?? 0);
        setDelivery(data.delivery ?? null);
      }
      if (mRes.ok) {
        const data = (await mRes.json()) as {
          prepareDryRun?: {
            executable?: boolean;
            missingInformation?: Array<{ code?: string; message?: string }>;
            validations?: Array<{ code?: string; message?: string }>;
          };
          executeDryRun?: { executable?: boolean };
          mergeOutcome?: MergeOutcome | null;
        };
        setMergeReady(Boolean(data.prepareDryRun?.executable));
        setExecuteMergeReady(Boolean(data.executeDryRun?.executable));
        setMergeOutcome(data.mergeOutcome ?? null);
        const block =
          data.prepareDryRun?.missingInformation?.[0]?.message ??
          data.prepareDryRun?.validations?.find((v) => v.code && v.code !== "ok")?.message ??
          null;
        setMergeBlockReason(data.prepareDryRun?.executable ? null : block);
      }
      if (eRes.ok) {
        const data = (await eRes.json()) as {
          dryRun?: {
            executable?: boolean;
            missingInformation?: Array<{ code?: string; message?: string }>;
          };
          exportPackage?: ExportPkg | null;
        };
        setExportReady(Boolean(data.dryRun?.executable));
        setExportPkg(data.exportPackage ?? null);
        setExportBlockReason(
          data.dryRun?.executable ? null : (data.dryRun?.missingInformation?.[0]?.message ?? null),
        );
      }
    } catch {
      setError("Lecture livraison impossible.");
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, [projectId]);

  async function qcDry() {
    if (busy) return;
    setBusy("qc-dry");
    setError(null);
    try {
      const response = await fetch(`/api/director/projects/${projectId}/quality`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "dry_run" }),
      });
      const data = (await response.json()) as {
        dryRun?: EvaluateQualityDryRunResult;
        error?: string;
      };
      if (!response.ok) setError(data.error ?? "Dry-run QC impossible.");
      else if (data.dryRun) {
        setQualityDry(data.dryRun);
        if (data.dryRun.quality) setQuality(data.dryRun.quality);
      }
    } catch {
      setError("Dry-run QC impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function qcExecute() {
    if (busy) return;
    const ok = await confirm({
      title: "Exécuter le contrôle qualité ?",
      message: "Persiste le rapport QC et met à jour le ProductionResult. Aucun provider réseau.",
      confirmLabel: "Exécuter QC",
    });
    if (!ok) return;
    setBusy("qc-exec");
    setError(null);
    try {
      const response = await fetch(`/api/director/projects/${projectId}/quality`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "execute", confirmation: true }),
      });
      const data = (await response.json()) as {
        quality?: FinalQualityReport;
        productionResultRevision?: number;
        error?: { message?: string } | string;
      };
      if (!response.ok) {
        setError(
          typeof data.error === "string" ? data.error : data.error?.message ?? "QC impossible.",
        );
      } else {
        if (data.quality) setQuality(data.quality);
        if (data.productionResultRevision) setPrRev(data.productionResultRevision);
        await refresh();
      }
    } catch {
      setError("QC impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function recordReview(decision: "approved" | "rejected") {
    if (busy || qualityRev == null || !prRev) return;
    if (decision === "approved" && !reviewComment.trim()) {
      setError("Justification requise pour une acceptation.");
      return;
    }
    const ok = await confirm({
      title: decision === "approved" ? "Accepter après revue ?" : "Rejeter après revue ?",
      message: "Décision append-only sur le rapport QC actif. Les blocages techniques ne sont pas contournables.",
      confirmLabel: decision === "approved" ? "Accepter" : "Rejeter",
    });
    if (!ok) return;
    setBusy("review");
    setError(null);
    try {
      const response = await fetch(`/api/director/projects/${projectId}/quality/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmation: true,
          decision,
          reviewedIssueCodes: quality?.blockingIssues.map((i) => i.code) ?? [],
          comment: reviewComment.trim() || undefined,
          expectedQualityReportRevision: qualityRev,
          expectedProductionResultRevision: prRev,
        }),
      });
      const data = (await response.json()) as { error?: { message?: string } | string };
      if (!response.ok) {
        setError(
          typeof data.error === "string" ? data.error : data.error?.message ?? "Revue impossible.",
        );
      } else {
        setReviewComment("");
        await refresh();
      }
    } catch {
      setError("Revue impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function mergePrepare() {
    if (busy) return;
    setBusy("merge-prep");
    setError(null);
    try {
      const response = await fetch(`/api/director/projects/${projectId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "prepare", confirmation: true }),
      });
      const data = (await response.json()) as { error?: { message?: string } | string };
      if (!response.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? "Préparation merge impossible.",
        );
      } else await refresh();
    } catch {
      setError("Préparation merge impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function mergeExecute() {
    if (busy) return;
    const ok = await confirm({
      title: "Lancer le merge fake ?",
      message:
        "Exécute le MergeEngine fake uniquement — aucun appel fal réel. Un asset final déterministe est persisté si le plan est exécutable.",
      confirmLabel: "Merger (fake)",
    });
    if (!ok) return;
    setBusy("merge-exec");
    setError(null);
    try {
      const response = await fetch(`/api/director/projects/${projectId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "execute", confirmation: true }),
      });
      const data = (await response.json()) as { error?: { message?: string } | string };
      if (!response.ok) {
        setError(
          typeof data.error === "string" ? data.error : data.error?.message ?? "Merge impossible.",
        );
      } else await refresh();
    } catch {
      setError("Merge impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function exportPrepare() {
    if (busy) return;
    const ok = await confirm({
      title: "Préparer l'export ?",
      message: "Construit un ExportPackage redacted (destination download). Aucun envoi AICCOS réel.",
      confirmLabel: "Préparer l'export",
    });
    if (!ok) return;
    setBusy("export");
    setError(null);
    try {
      const response = await fetch(`/api/director/projects/${projectId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "execute",
          confirmation: true,
          destinationId: "download",
        }),
      });
      const data = (await response.json()) as { error?: { message?: string } | string };
      if (!response.ok) {
        setError(
          typeof data.error === "string" ? data.error : data.error?.message ?? "Export impossible.",
        );
      } else await refresh();
    } catch {
      setError("Export impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function downloadMedia() {
    if (busy || !exportPkg) return;
    setBusy("dl-media");
    setError(null);
    try {
      const response = await fetch(`/api/director/projects/${projectId}/export/download`);
      if (!response.ok) {
        let message = "Téléchargement média impossible.";
        try {
          const data = (await response.json()) as {
            error?: { message?: string } | string;
          };
          message =
            typeof data.error === "string"
              ? data.error
              : data.error?.message ?? message;
        } catch {
          /* non-JSON error body */
        }
        setError(message);
        return;
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? "vh-final-media.bin";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Téléchargement média impossible.");
    } finally {
      setBusy(null);
    }
  }

  const unknowns =
    quality?.technicalChecks
      .concat(quality.contractualChecks, quality.editorialChecks)
      .filter((c) => c.outcome === "unknown") ?? [];

  return (
    <section className="mt-10" aria-labelledby="delivery-heading">
      <h2 id="delivery-heading" className="text-base font-semibold mb-2">
        Livraison
      </h2>
      <p className="text-sm text-[var(--muted)] mb-4">
        QC → revue humaine → MergePlan → merge fake → ExportPackage. Aucun fal / AICCOS réel.
        <code className="ml-1">unknown</code> ne devient jamais <code>pass</code>.
      </p>
      <p className="text-xs text-[var(--muted)] mb-4" role="status">
        {buildMergeExportSectionView({ runtimeOff: true }).disabledReason}
      </p>

      <div className="flex flex-wrap gap-3 mb-4">
        <button type="button" className="btn btn-primary" onClick={qcDry} disabled={busy != null}>
          {busy === "qc-dry" ? "Vérification…" : "Dry-run QC"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={qcExecute}
          disabled={busy != null || !qualityDry?.executable}
        >
          {busy === "qc-exec" ? "QC…" : "Exécuter QC"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={mergePrepare}
          disabled={busy != null || !mergeReady}
        >
          {busy === "merge-prep" ? "Préparation…" : "Préparer merge"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={mergeExecute}
          disabled={busy != null || !executeMergeReady}
        >
          {busy === "merge-exec" ? "Merge…" : "Lancer merge fake"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={exportPrepare}
          disabled={busy != null || !exportReady}
        >
          {busy === "export" ? "Export…" : "Préparer export"}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void downloadMedia()}
          disabled={busy != null || !exportPkg}
          aria-label="Télécharger le média final"
        >
          {busy === "dl-media" ? "Téléchargement…" : "Télécharger le média final"}
        </button>
        <a
          className={`btn btn-ghost ${exportPkg ? "" : "pointer-events-none opacity-50"}`}
          href={`/api/director/projects/${projectId}/export/manifest`}
          aria-disabled={!exportPkg}
          aria-label="Télécharger le manifeste JSON redacted"
        >
          Voir le manifeste
        </a>
      </div>

      {error && (
        <p className="text-sm text-[var(--danger)] mb-2" role="alert">
          {error}
        </p>
      )}

      <div className="card p-4 mb-4 text-sm space-y-2">
        <p>
          Delivery · {delivery?.status ?? "not_started"} · ProductionResult rév. {prRev || "—"}
        </p>
        {delivery?.status === "merge_ready" && !mergeReady && (
          <p className="text-[var(--muted)]">
            <code>merge_ready</code> seul n’autorise pas le merge ni l’export.
          </p>
        )}
        {delivery?.blockingCodes?.length ? (
          <p className="text-[var(--danger)]">
            Blocages : {delivery.blockingCodes.join(", ")}
          </p>
        ) : null}
        {qualityDry && (
          <p className="text-[var(--muted)]">
            Dry-run QC · {qualityDry.executable ? "prêt" : "non prêt"} · providerCalled: false
          </p>
        )}
      </div>

      {quality && (
        <div className="card p-4 mb-4 text-sm space-y-2">
          <p>
            QC · statut global <strong>{quality.status}</strong> · politique{" "}
            {quality.validatorVersion} · rév. {qualityRev ?? "—"}
          </p>
          <p className="text-[var(--muted)]">
            Technique {quality.technicalChecks.filter((c) => c.outcome === "pass").length}/
            {quality.technicalChecks.length} pass · Contractuel{" "}
            {quality.contractualChecks.filter((c) => c.outcome === "pass").length}/
            {quality.contractualChecks.length} · Éditorial{" "}
            {quality.editorialChecks.filter((c) => c.outcome === "pass").length}/
            {quality.editorialChecks.length}
          </p>
          {unknowns.length > 0 && (
            <p className="text-[var(--muted)]">
              Unknowns (≠ pass) :{" "}
              {unknowns.map((u) => `${u.code}:${outcomeLabel(u.outcome)}`).join(", ")}
            </p>
          )}
          {quality.blockingIssues.length > 0 && (
            <ul className="list-disc pl-5 text-[var(--danger)]">
              {quality.blockingIssues.map((i) => (
                <li key={`${i.code}-${i.sceneId ?? ""}`}>
                  [{i.layer}] {i.code} — {i.message}
                  {i.blocking ? " (bloquant)" : ""}
                </li>
              ))}
            </ul>
          )}
          {quality.status === "needs_review" && !delivery?.humanReviewId && (
            <div className="mt-3 space-y-2">
              <label className="block text-[var(--muted)]" htmlFor="review-comment">
                Commentaire de revue (requis pour acceptation)
              </label>
              <textarea
                id="review-comment"
                className="w-full min-h-[4rem] rounded border border-[var(--border)] bg-transparent p-2"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                maxLength={2000}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy != null}
                  onClick={() => void recordReview("approved")}
                >
                  Accepter
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy != null}
                  onClick={() => void recordReview("rejected")}
                >
                  Rejeter
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card p-4 mb-4 text-sm space-y-2">
        <p>
          Merge · readiness {mergeReady ? "OK" : "non"} · execute{" "}
          {executeMergeReady ? "disponible" : "indisponible"} · état{" "}
          {mergeOutcome?.status ?? "—"}
        </p>
        {mergeBlockReason && (
          <p className="text-[var(--muted)]">Blocage merge : {mergeBlockReason}</p>
        )}
        {mergeOutcome?.reason && (
          <p className="text-[var(--muted)]">Raison : {mergeOutcome.reason}</p>
        )}
        {mergeOutcome?.finalAsset?.id && (
          <p className="text-[var(--muted)]">
            Asset final {mergeOutcome.finalAsset.id} · {mergeOutcome.finalAsset.mimeType ?? "—"}
          </p>
        )}
      </div>

      <div className="card p-4 text-sm space-y-2">
        <p>
          Export · readiness {exportReady ? "OK" : "non"} · paquet{" "}
          {exportPkg?.id ? exportPkg.id.slice(0, 8) + "…" : "—"}
        </p>
        {exportBlockReason && (
          <p className="text-[var(--muted)]">Blocage export : {exportBlockReason}</p>
        )}
        {exportPkg?.manifest && (
          <p className="text-[var(--muted)]">
            Manifeste sûr · asset {exportPkg.manifest.finalAssetId ?? "—"} · qualité{" "}
            {exportPkg.manifest.quality?.status ?? "—"} · destination download
          </p>
        )}
        <p className="text-[var(--muted)]">AICCOS : stub non configuré — aucun envoi réel.</p>
      </div>
    </section>
  );
}
