"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { MarketingPlanView } from "@/application/directors/marketing";
import type { CreativeConceptView } from "@/application/directors/creative/analyze-for-project";
import type { VideoScriptView } from "@/application/directors/script/analyze-for-project";
import type { VisualDirectionView } from "@/application/directors/art/analyze-for-project";
import type { StoryboardProjectView } from "@/application/directors/storyboard/analyze-for-project";
import type { ScenePackageSetView } from "@/application/directors/prompt/build-for-project";
import type { GenerationPlanView } from "@/application/directors/routing/route-for-project";
import type { ArtifactType } from "@/domain/project";
import { BriefSection, type BriefSectionInitial } from "./brief-section";
import { MarketingSection } from "./marketing-section";
import { CreativeSection } from "./creative-section";
import { ScriptSection } from "./script-section";
import { ArtSection } from "./art-section";
import { StoryboardSection } from "./storyboard-section";
import { PromptSection } from "./prompt-section";
import { RoutingSection } from "./routing-section";
import { ProductionSection } from "./production-section";
import { LipsyncSection } from "./lipsync-section";
import { MergeExportSection } from "./merge-export-section";
import { VoiceNarratorSelector } from "./voice-narrator-selector";
import { DeliverySection } from "./delivery-section";
import { MotionReviewSection } from "./motion-review-section";
import { StaleBadge } from "./stale-badge";
import { DirectorPipelineProgress } from "./director-pipeline-progress";
import {
  buildDirectorPipelineProgress,
  humanArtifactLabel,
} from "./director-pipeline-progress-model";
import {
  announceDirectorStepReady,
  DIRECTOR_STEP_READY_EVENT,
  type DirectorPipelineReadyStep,
} from "./director-pipeline-events";
import { DirectorUpdateBlockerStatus } from "./director-update-blocker-status";

type Props = {
  projectId: string;
  projectRevision: number;
  brief: BriefSectionInitial;
  initialPlan: MarketingPlanView | null;
  initialConcept: CreativeConceptView | null;
  initialScript: VideoScriptView | null;
  initialVisualDirection: VisualDirectionView | null;
  initialStoryboard: StoryboardProjectView | null;
  initialPackageSet: ScenePackageSetView | null;
  initialPlanRouting: GenerationPlanView | null;
};

function SectionShell({
  id,
  type,
  staleMap,
  restartPoint,
  children,
}: {
  id: string;
  type: ArtifactType;
  staleMap: Partial<Record<ArtifactType, string | null>>;
  restartPoint: ArtifactType | null;
  children: ReactNode;
}) {
  const stale = type in staleMap;
  return (
    <div id={id}>
      {stale && (
        <div className="mt-8 mb-[-0.5rem] flex flex-wrap items-center gap-2">
          <StaleBadge
            stale
            reason={staleMap[type]}
            restartHint={restartPoint}
          />
          <p className="text-xs text-[var(--danger)]" role="status">
            Actions basées sur cette révision active sont refusées jusqu&apos;à
            relance depuis le point de reprise.
          </p>
        </div>
      )}
      {children}
    </div>
  );
}

export function DirectorProjectClient({
  projectId,
  projectRevision: initialProjectRevision,
  brief,
  initialPlan,
  initialConcept,
  initialScript,
  initialVisualDirection,
  initialStoryboard,
  initialPackageSet,
  initialPlanRouting,
}: Props) {
  const [projectRevision, setProjectRevision] = useState(initialProjectRevision);
  const [staleMap, setStaleMap] = useState<Partial<Record<ArtifactType, string | null>>>({});
  const [restartPoint, setRestartPoint] = useState<ArtifactType | null>(null);
  const [readySteps, setReadySteps] = useState({
    marketing: Boolean(initialPlan),
    creative: Boolean(initialConcept),
    script: Boolean(initialScript),
    voice: false,
    art: Boolean(initialVisualDirection),
    storyboard: Boolean(initialStoryboard),
    prompt: Boolean(initialPackageSet),
    routing: Boolean(initialPlanRouting),
    production: false,
    lipsync: false,
    merge: false,
    export: false,
  });

  const refreshStale = useCallback(async () => {
    try {
      const res = await fetch(`/api/director/projects/${projectId}/stale`);
      const data = (await res.json()) as {
        stale?: Array<{ artifactType: ArtifactType; staleReason: string | null }>;
        restartPoint?: ArtifactType | null;
        projectRevision?: number;
      };
      if (!res.ok) return;
      const next: Partial<Record<ArtifactType, string | null>> = {};
      for (const row of data.stale ?? []) {
        next[row.artifactType] = row.staleReason;
      }
      setStaleMap(next);
      setRestartPoint(data.restartPoint ?? null);
      if (data.projectRevision != null) setProjectRevision(data.projectRevision);
    } catch {
      /* ignore */
    }
  }, [projectId]);

  useEffect(() => {
    void refreshStale();
  }, [refreshStale]);

  useEffect(() => {
    const onReady = (event: Event) => {
      const step = (event as CustomEvent<{ step?: DirectorPipelineReadyStep }>).detail?.step;
      if (!step) return;
      setReadySteps((prev) => (prev[step] ? prev : { ...prev, [step]: true }));
    };
    window.addEventListener(DIRECTOR_STEP_READY_EVENT, onReady);
    return () => window.removeEventListener(DIRECTOR_STEP_READY_EVENT, onReady);
  }, []);

  const pipeline = buildDirectorPipelineProgress({
    hasBrief: true,
    hasMarketing: readySteps.marketing,
    hasCreative: readySteps.creative,
    hasScript: readySteps.script,
    hasVoiceChoice: readySteps.voice,
    hasArt: readySteps.art,
    hasStoryboard: readySteps.storyboard,
    hasPrompts: readySteps.prompt,
    hasRouting: readySteps.routing,
    hasProduction: readySteps.production,
    lipsyncPrepared: readySteps.lipsync,
    mergePrepared: readySteps.merge,
    exportPrepared: readySteps.export,
  });

  return (
    <>
      <DirectorUpdateBlockerStatus />
      <DirectorPipelineProgress view={pipeline} />
      <div id="section-brief">
      <BriefSection
        projectId={projectId}
        projectRevision={projectRevision}
        initialBrief={brief}
        onRevised={({ projectRevision: next, restartPoint: rp }) => {
          setProjectRevision(next);
          setRestartPoint(rp);
          void refreshStale();
        }}
      />
      </div>

      {restartPoint && Object.keys(staleMap).length > 0 && (
        <div className="card p-4 mb-6 text-sm" role="status" aria-live="polite">
          <p className="font-medium mb-1">Pipeline obsolète</p>
          <p className="text-[var(--muted)]">
            {Object.keys(staleMap).length} section(s) marquée(s) obsolète(s). Point de
            reprise recommandé : <strong>{humanArtifactLabel(restartPoint)}</strong>. Relancez
            cette étape — production, contrôle qualité, assemblage et export restent
            bloqués tant que les prérequis ne sont pas à jour.
          </p>
          <a
            href={`#section-${restartPoint}`}
            className="btn btn-primary mt-3 inline-flex"
          >
            Aller à {humanArtifactLabel(restartPoint)}
          </a>
        </div>
      )}

      <SectionShell
        id="section-marketing_plan"
        type="marketing_plan"
        staleMap={staleMap}
        restartPoint={restartPoint}
      >
        <MarketingSection projectId={projectId} initialPlan={initialPlan} />
      </SectionShell>
      <SectionShell
        id="section-creative_concept"
        type="creative_concept"
        staleMap={staleMap}
        restartPoint={restartPoint}
      >
        <CreativeSection projectId={projectId} initialConcept={initialConcept} />
      </SectionShell>
      <SectionShell
        id="section-video_script"
        type="video_script"
        staleMap={staleMap}
        restartPoint={restartPoint}
      >
        <ScriptSection projectId={projectId} initialScript={initialScript} />
        <div id="section-voice">
          <VoiceNarratorSelector
            onSelected={(selected) => {
              if (selected) announceDirectorStepReady("voice");
            }}
          />
        </div>
      </SectionShell>
      <SectionShell
        id="section-visual_direction"
        type="visual_direction"
        staleMap={staleMap}
        restartPoint={restartPoint}
      >
        <ArtSection
          projectId={projectId}
          initialVisualDirection={initialVisualDirection}
        />
      </SectionShell>
      <SectionShell
        id="section-storyboard_project"
        type="storyboard_project"
        staleMap={staleMap}
        restartPoint={restartPoint}
      >
        <StoryboardSection
          projectId={projectId}
          initialStoryboard={initialStoryboard}
        />
      </SectionShell>
      <SectionShell
        id="section-scene_package_set"
        type="scene_package_set"
        staleMap={staleMap}
        restartPoint={restartPoint}
      >
        <PromptSection projectId={projectId} initialPackageSet={initialPackageSet} />
      </SectionShell>
      <SectionShell
        id="section-generation_plan"
        type="generation_plan"
        staleMap={staleMap}
        restartPoint={restartPoint}
      >
        <RoutingSection
          projectId={projectId}
          projectRevision={projectRevision}
          initialPlan={initialPlanRouting}
          onProjectRevision={setProjectRevision}
        />
      </SectionShell>
      <SectionShell
        id="section-production_result"
        type="production_result"
        staleMap={staleMap}
        restartPoint={restartPoint}
      >
        <ProductionSection
          projectId={projectId}
          projectRevision={projectRevision}
          onProjectRevision={setProjectRevision}
        />
      </SectionShell>
      <LipsyncSection
        videoResolved={Boolean(initialPlanRouting)}
        audioResolved={Boolean(initialScript)}
      />
      <MergeExportSection
        videoResolved={Boolean(initialPlanRouting)}
        audioResolved={Boolean(initialScript)}
        lipsyncResolved={Boolean(initialPlanRouting) && Boolean(initialScript)}
      />
      <SectionShell
        id="section-export_package"
        type="export_package"
        staleMap={staleMap}
        restartPoint={restartPoint}
      >
        <DeliverySection projectId={projectId} />
        <MotionReviewSection projectId={projectId} />
      </SectionShell>
    </>
  );
}
