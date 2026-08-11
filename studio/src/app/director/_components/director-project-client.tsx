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
import { DeliverySection } from "./delivery-section";
import { MotionReviewSection } from "./motion-review-section";
import { StaleBadge } from "./stale-badge";

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

  return (
    <>
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

      {restartPoint && Object.keys(staleMap).length > 0 && (
        <div className="card p-4 mb-6 text-sm" role="status" aria-live="polite">
          <p className="font-medium mb-1">Pipeline obsolète</p>
          <p className="text-[var(--muted)]">
            {Object.keys(staleMap).length} section(s) marquée(s) obsolète(s). Point de
            reprise recommandé : <strong>{restartPoint}</strong>. Relancez le Directeur
            correspondant — production / QC / merge / export refusés tant que les
            prérequis restent stale.
          </p>
          <a
            href={`#section-${restartPoint}`}
            className="btn btn-primary mt-3 inline-flex"
          >
            Aller à {restartPoint}
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
