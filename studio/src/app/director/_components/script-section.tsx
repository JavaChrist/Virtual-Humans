"use client";
import { useState } from "react";
import { useConfirm } from "@/components/confirm";
import type { ScriptProjectDryRunResult, VideoScriptView } from "@/application/directors/script/analyze-for-project";

export function ScriptSection({ projectId, initialScript = null }: { projectId: string; initialScript?: VideoScriptView | null }) {
  const confirm = useConfirm();
  const [dry, setDry] = useState<ScriptProjectDryRunResult | null>(null);
  const [script, setScript] = useState<VideoScriptView | null>(initialScript);
  const [busy, setBusy] = useState<"dry" | "execute" | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function check() {
    if (busy) return; setBusy("dry"); setError(null);
    try { const response = await fetch(`/api/director/projects/${projectId}/script`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({mode:"dry_run"}) }); const data = await response.json() as {dryRun?:ScriptProjectDryRunResult;error?:string}; if(!response.ok) setError(data.error ?? "Vérification impossible."); else if(data.dryRun){setDry(data.dryRun);setScript(data.dryRun.existingScript ?? script);} } catch { setError("Vérification impossible."); } finally { setBusy(null); }
  }
  async function execute() {
    if (busy || !dry?.executionAvailable) return;
    if (!await confirm({title:"Lancer la rédaction du script ?",message:"Cet appel est payant. Les artefacts actifs ne seront pas modifiés.",confirmLabel:"Rédiger le script"})) return;
    setBusy("execute"); setError(null);
    try { const response=await fetch(`/api/director/projects/${projectId}/script`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:"execute",expectedCreativeConceptRevision:dry.creativeConceptRevision,expectedMarketingPlanRevision:dry.marketingPlanRevision})}); const data=await response.json() as {script?:VideoScriptView;error?:{message?:string}};if(!response.ok)setError(data.error?.message??"Rédaction impossible.");else if(data.script)setScript(data.script); } catch { setError("Rédaction impossible."); } finally { setBusy(null); }
  }
  return <section className="mt-10" aria-labelledby="script-heading">
    <h2 id="script-heading" className="text-base font-semibold mb-2">Script</h2>
    <p className="text-sm text-[var(--muted)] mb-4">Le script est construit à partir du Brief, du Marketing Plan et du Creative Concept actifs.</p>
    <div className="flex flex-wrap gap-3 mb-4"><button type="button" className="btn btn-primary" onClick={check} disabled={busy!=null}>{busy==="dry"?"Vérification…":"Vérifier les prérequis"}</button><button type="button" className="btn btn-ghost" onClick={execute} disabled={busy!=null||!dry?.executionAvailable}>{busy==="execute"?"Rédaction…":"Rédiger le script"}</button></div>
    {error&&<p className="text-sm text-[var(--danger)] mb-2" role="alert">{error}</p>}
    {dry&&<div className="card p-4 mb-4 text-sm"><p>Dry-run · {dry.executable?"prêt":"pré-requis incomplets"} · exécution {dry.executionAvailable?"disponible":"indisponible"}</p>{dry.targetDuration!=null&&<p>Durée cible : {dry.targetDuration}s{dry.estimatedDuration!=null?` · estimation : ${dry.estimatedDuration}s`:""}</p>}{dry.warnings.map(w=><p key={w.code} className="text-[var(--muted)]">{w.message}</p>)}{dry.missingInformation.map(m=><p key={m.code} className="text-[var(--danger)]">{m.message}</p>)}</div>}
    {script&&<dl className="card p-5 grid gap-3 text-sm"><div><dt className="text-[var(--muted)]">Révision</dt><dd>{script.revision}</dd></div>{script.title&&<div><dt className="text-[var(--muted)]">Titre</dt><dd>{script.title}</dd></div>}{script.summary&&<div><dt className="text-[var(--muted)]">Résumé</dt><dd>{script.summary}</dd></div>}{script.hook&&<div><dt className="text-[var(--muted)]">Hook</dt><dd>{script.hook}</dd></div>}{script.segments&&<div><dt className="text-[var(--muted)]">Segments</dt><dd>{script.segments.map(s=><p key={`${s.purpose}-${s.text}`}>{s.purpose} · {s.text}</p>)}</dd></div>}{script.cta&&<div><dt className="text-[var(--muted)]">CTA</dt><dd>{script.cta}</dd></div>}{script.targetDuration!=null&&<div><dt className="text-[var(--muted)]">Durée</dt><dd>{script.calculatedDuration}s / {script.targetDuration}s · {script.toleranceStatus}</dd></div>}</dl>}
  </section>;
}
