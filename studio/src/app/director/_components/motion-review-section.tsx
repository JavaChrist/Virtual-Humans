"use client";

/**
 * MT-010 — Motion Transfer human review panel (extends Director UI).
 * No provider / enqueue / merge / export. Uses useConfirm — never native alert.
 */

import { useCallback, useEffect, useId, useState } from "react";
import { useConfirm } from "@/components/confirm";
import { useUpdateBlocker } from "@/lib/use-update-blocker";
import { UPDATE_BLOCKER_IDS, UPDATE_BLOCKER_REASONS } from "@/lib/update-blocker-reasons";

type MotionReviewContext = {
  runId: string;
  jobId: string;
  resultId: string;
  revision: number;
  overallStatus: string;
  humanValidationRequired: boolean;
  layerStatuses: Record<string, string>;
  checkpointResults: Array<{ checkpointId: string; status: string; notes?: string }>;
  issues: Array<{
    code: string;
    severity: string;
    message: string;
    layer?: string;
    requirementClass?: string;
  }>;
  evidence: Array<{
    evidenceId: string;
    role: string;
    mimeType: string;
    contentFingerprint: string;
    available: boolean;
  }>;
  allowedDecisions: string[];
  approveBlockedReasons: string[];
  currentDecision: string | null;
  costSummary: {
    estimatedCostMinor?: number;
    reservedMinor?: number;
    actualCostMinor?: number;
    currency: string;
  };
  provenance: {
    policyId: string;
    policyVersion: string;
    measurementVersion: string;
    correlationId: string;
    createdBy: string;
    outputRefFingerprint: string;
  };
  humanAttestationRequired: boolean;
};

type UiStatus = "idle" | "loading" | "error" | "conflict" | "existing" | "success";

const DECISION_LABELS: Record<string, string> = {
  approved: "Approuver",
  rejected: "Rejeter",
  retry_same_reference: "Retry même référence",
  retry_updated_constraints: "Retry contraintes mises à jour",
  request_new_reference: "Demander nouvelle référence",
};

function layerLabel(status: string): string {
  if (status === "pass") return "OK";
  if (status === "fail") return "Échec";
  if (status === "unknown") return "Indispo.";
  return status;
}

function newReviewRequestId(decision: string): string {
  try {
    return globalThis.crypto.randomUUID();
  } catch {
    return `rvw-${decision}-${Math.floor(Math.random() * 1e12)}`;
  }
}

export function MotionReviewSection({ projectId }: { projectId: string }) {
  const confirm = useConfirm();
  const formId = useId();
  const [ctx, setCtx] = useState<MotionReviewContext | null>(null);
  const [ui, setUi] = useState<UiStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [constraintsRef, setConstraintsRef] = useState("");
  const [attestation, setAttestation] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState(false);
  useUpdateBlocker(
    decisionBusy,
    UPDATE_BLOCKER_IDS.directorMotionReview,
    UPDATE_BLOCKER_REASONS.saving,
  );

  const load = useCallback(async () => {
    setUi("loading");
    setError(null);
    try {
      const res = await fetch(
        `/api/director/projects/${projectId}/motion/review`,
        { headers: { Accept: "application/json" } },
      );
      if (res.status === 404) {
        setUnavailable(true);
        setCtx(null);
        setUi("idle");
        return;
      }
      const data = (await res.json()) as {
        context?: MotionReviewContext;
        error?: { message?: string } | string;
      };
      if (!res.ok) {
        setUnavailable(true);
        setCtx(null);
        setUi("error");
        setError(
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? "Contexte Motion indisponible.",
        );
        return;
      }
      setUnavailable(false);
      setCtx(data.context ?? null);
      setUi("idle");
    } catch {
      setUi("error");
      setError("Lecture revue Motion impossible.");
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitDecision(decision: string) {
    if (!ctx || ui === "loading") return;
    if (!ctx.allowedDecisions.includes(decision)) return;

    const needsComment =
      decision === "rejected" || decision === "request_new_reference";
    if (needsComment && !comment.trim()) {
      setError("Justification obligatoire pour cette décision.");
      setUi("error");
      return;
    }
    if (decision === "retry_updated_constraints" && !constraintsRef.trim()) {
      setError("Référence de contraintes versionnée requise.");
      setUi("error");
      return;
    }
    if (
      decision === "approved" &&
      ctx.humanAttestationRequired &&
      !attestation
    ) {
      setError("Attestation humaine requise pour approuver.");
      setUi("error");
      return;
    }

    const ok = await confirm({
      title: `${DECISION_LABELS[decision] ?? decision} ?`,
      message:
        "Décision append-only. Aucun job provider, merge ou export ne sera lancé automatiquement.",
      confirmLabel: DECISION_LABELS[decision] ?? "Confirmer",
    });
    if (!ok) return;

    setDecisionBusy(true);
    setUi("loading");
    setError(null);
    setSelected(decision);
    const reviewRequestId = newReviewRequestId(decision);

    try {
      const res = await fetch(
        `/api/director/projects/${projectId}/motion/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            confirmation: true,
            decision,
            expectedRevision: ctx.revision,
            reviewRequestId,
            comment: comment.trim() || undefined,
            updatedConstraintsRef: constraintsRef.trim() || undefined,
            humanAttestation: attestation || undefined,
            runId: ctx.runId,
          }),
        },
      );
      const data = (await res.json()) as {
        status?: string;
        error?: { message?: string; code?: string } | string;
        revision?: number;
      };
      if (res.status === 409 || data.status === "conflict") {
        setUi("conflict");
        setError(
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? "Conflit — recharger le contexte.",
        );
        await load();
        return;
      }
      if (!res.ok) {
        setUi("error");
        setError(
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? "Enregistrement impossible.",
        );
        return;
      }
      if (data.status === "existing") {
        setUi("existing");
      } else {
        setUi("success");
      }
      setComment("");
      setConstraintsRef("");
      setAttestation(false);
      await load();
    } catch {
      setUi("error");
      setError("Enregistrement revue Motion impossible.");
    } finally {
      setDecisionBusy(false);
      setSelected(null);
    }
  }

  if (unavailable && !ctx) {
    return (
      <section
        aria-labelledby={`${formId}-title`}
        style={{ marginTop: "1.5rem" }}
      >
        <h2 id={`${formId}-title`} style={{ fontSize: "1.1rem" }}>
          Revue Motion Transfer
        </h2>
        <p style={{ color: "var(--muted, #9aa4b2)", fontSize: "0.9rem" }}>
          Aucun résultat Motion en attente de revue (runtime unavailable / hors
          harness).
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby={`${formId}-title`}
      style={{ marginTop: "1.5rem" }}
    >
      <h2 id={`${formId}-title`} style={{ fontSize: "1.1rem" }}>
        Revue Motion Transfer
      </h2>
      <p style={{ fontSize: "0.85rem", color: "var(--muted, #9aa4b2)" }}>
        Validation humaine append-only — aucun retry provider automatique.
      </p>

      <div
        role="status"
        aria-live="polite"
        style={{ margin: "0.5rem 0", fontSize: "0.85rem" }}
      >
        {ui === "loading" && <span>Chargement…</span>}
        {ui === "success" && <span>Décision enregistrée.</span>}
        {ui === "existing" && <span>Décision déjà enregistrée (idempotent).</span>}
        {ui === "conflict" && (
          <span>Conflit de révision — contexte rechargé.</span>
        )}
        {error && (
          <span style={{ color: "var(--danger, #c44)" }}>{error}</span>
        )}
      </div>

      {ctx && (
        <>
          <div
            style={{
              display: "grid",
              gap: "0.35rem",
              fontSize: "0.9rem",
              marginBottom: "0.75rem",
            }}
          >
            <div>
              <strong>Statut QC :</strong> {ctx.overallStatus}
              {ctx.humanValidationRequired ? " · revue humaine requise" : ""}
              {ctx.currentDecision
                ? ` · décision courante : ${ctx.currentDecision}`
                : ""}
            </div>
            <div>
              <strong>Révision :</strong> {ctx.revision} · run {ctx.runId}
            </div>
            <div>
              <strong>Coût (¢) :</strong> est.{" "}
              {ctx.costSummary.estimatedCostMinor ?? "—"} / rés.{" "}
              {ctx.costSummary.reservedMinor ?? "—"}{" "}
              {ctx.costSummary.currency}
            </div>
            <div>
              <strong>Provenance :</strong> policy {ctx.provenance.policyId}@
              {ctx.provenance.policyVersion} · meas{" "}
              {ctx.provenance.measurementVersion} · out{" "}
              {ctx.provenance.outputRefFingerprint}
            </div>
          </div>

          <h3 style={{ fontSize: "0.95rem" }}>Couches QC</h3>
          <ul style={{ fontSize: "0.85rem", paddingLeft: "1.2rem" }}>
            {Object.entries(ctx.layerStatuses).map(([k, v]) => (
              <li key={k}>
                <span>{k}</span>
                {" — "}
                <span aria-label={`statut ${layerLabel(v)}`}>{layerLabel(v)}</span>
                {v === "fail" ? " (!)" : ""}
              </li>
            ))}
          </ul>

          <h3 style={{ fontSize: "0.95rem" }}>Issues</h3>
          {ctx.issues.length === 0 ? (
            <p style={{ fontSize: "0.85rem" }}>Aucune issue.</p>
          ) : (
            <ul style={{ fontSize: "0.85rem", paddingLeft: "1.2rem" }}>
              {ctx.issues.map((i) => (
                <li key={i.code}>
                  [{i.severity}] {i.code} — {i.message}
                </li>
              ))}
            </ul>
          )}

          <h3 style={{ fontSize: "0.95rem" }}>Checkpoints</h3>
          <ul style={{ fontSize: "0.85rem", paddingLeft: "1.2rem" }}>
            {ctx.checkpointResults.map((c) => (
              <li key={c.checkpointId}>
                {c.checkpointId}: {c.status}
              </li>
            ))}
          </ul>

          <h3 style={{ fontSize: "0.95rem" }}>Evidence</h3>
          <ul style={{ fontSize: "0.85rem", paddingLeft: "1.2rem" }}>
            {ctx.evidence.map((e) => (
              <li key={e.evidenceId}>
                {e.role} · {e.mimeType} · fp {e.contentFingerprint.slice(0, 12)}…
                {e.available ? "" : " (indisponible)"}
              </li>
            ))}
          </ul>

          <div style={{ marginTop: "1rem", display: "grid", gap: "0.5rem" }}>
            <label htmlFor={`${formId}-comment`}>
              Justification
              <textarea
                id={`${formId}-comment`}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                style={{ display: "block", width: "100%", marginTop: 4 }}
              />
            </label>
            <label htmlFor={`${formId}-constraints`}>
              Ref. contraintes (retry updated)
              <input
                id={`${formId}-constraints`}
                value={constraintsRef}
                onChange={(e) => setConstraintsRef(e.target.value)}
                style={{ display: "block", width: "100%", marginTop: 4 }}
                autoComplete="off"
              />
            </label>
            {ctx.humanAttestationRequired && (
              <label
                htmlFor={`${formId}-attest`}
                style={{ display: "flex", gap: 8, alignItems: "center" }}
              >
                <input
                  id={`${formId}-attest`}
                  type="checkbox"
                  checked={attestation}
                  onChange={(e) => setAttestation(e.target.checked)}
                />
                J’atteste avoir vérifié fidélité / identité / tenue (humain)
              </label>
            )}
          </div>

          <div
            role="group"
            aria-label="Décisions de revue Motion"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
              marginTop: "0.75rem",
            }}
          >
            {(
              [
                "approved",
                "rejected",
                "retry_same_reference",
                "retry_updated_constraints",
                "request_new_reference",
              ] as const
            ).map((d) => {
              const enabled = ctx.allowedDecisions.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  disabled={!enabled || ui === "loading"}
                  aria-disabled={!enabled || ui === "loading"}
                  aria-pressed={selected === d}
                  onClick={() => void submitDecision(d)}
                  title={
                    !enabled
                      ? d === "approved"
                        ? ctx.approveBlockedReasons.join(", ") ||
                          "Non autorisé"
                        : "Non autorisé pour cet état"
                      : DECISION_LABELS[d]
                  }
                >
                  {DECISION_LABELS[d]}
                </button>
              );
            })}
            <button type="button" onClick={() => void load()} disabled={ui === "loading"}>
              Recharger
            </button>
          </div>
        </>
      )}
    </section>
  );
}
