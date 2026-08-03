import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import type { MarketingPlanView } from "@/application/directors/marketing";
import type { CreativeConceptView } from "@/application/directors/creative/analyze-for-project";
import type { VideoScriptView } from "@/application/directors/script/analyze-for-project";
import type { VisualDirectionView } from "@/application/directors/art/analyze-for-project";
import type { StoryboardProjectView } from "@/application/directors/storyboard/analyze-for-project";
import type { ScenePackageSetView } from "@/application/directors/prompt/build-for-project";
import type { GenerationPlanView } from "@/application/directors/routing/route-for-project";
import { canUseDirectorV2Persistence } from "@/infrastructure/config/feature-flags";
import { createDirectorPersistenceStack } from "@/infrastructure/db/director-server";
import { V2SupabaseConfigError } from "@/infrastructure/db/supabase-server";
import { logger } from "@/infrastructure/observability";
import { DirectorProjectClient } from "../_components/director-project-client";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ projectId: string }> };

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  youtube_shorts: "YouTube Shorts",
};

export default async function DirectorProjectPage({ params }: PageProps) {
  if (!canUseDirectorV2Persistence()) {
    notFound();
  }

  const { projectId } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      projectId
    )
  ) {
    notFound();
  }

  let errorMessage: string | null = null;
  let view: Awaited<
    ReturnType<ReturnType<typeof createDirectorPersistenceStack>["getProject"]["execute"]>
  > | null = null;
  let initialPlan: MarketingPlanView | null = null;
  let initialConcept: CreativeConceptView | null = null;
  let initialScript: VideoScriptView | null = null;
  let initialVisualDirection: VisualDirectionView | null = null;
  let initialStoryboard: StoryboardProjectView | null = null;
  let initialPackageSet: ScenePackageSetView | null = null;
  let initialPlanRouting: GenerationPlanView | null = null;
  let projectActiveRevision = 1;

  try {
    const stack = createDirectorPersistenceStack();
    view = await stack.getProject.execute(projectId, stack.workspaceId);
    const persisted = await stack.projects.load(projectId);
    if (persisted) projectActiveRevision = persisted.activeRevision;
    if (view.status === "ok") {
      logger.info("director.project.loaded", {
        correlationId: "page-director-project",
        route: `/director/${projectId}`,
        operation: "director.project.loaded",
      }, {
        projectId: view.view.project.id,
        status: view.view.project.status,
      });
      const dry = await stack.analyzeMarketing.dryRun(
        { projectId },
        { correlationId: "page-director-marketing", mode: "dry-run" }
      );
      initialPlan = dry.existingPlan ?? null;
      const creativeDry = await stack.analyzeCreative.dryRun(
        { projectId },
        { correlationId: "page-director-creative", mode: "dry-run" }
      );
      initialConcept = creativeDry.existingConcept ?? null;
      const scriptDry = await stack.writeScript.dryRun(
        { projectId },
        { correlationId: "page-director-script", mode: "dry-run" }
      );
      initialScript = scriptDry.existingScript ?? null;
      const artDry = await stack.analyzeArt.dryRun(
        { projectId },
        { correlationId: "page-director-art", mode: "dry-run" }
      );
      initialVisualDirection = artDry.existingVisualDirection ?? null;
      const storyboardDry = await stack.analyzeStoryboard.dryRun(
        { projectId },
        { correlationId: "page-director-storyboard", mode: "dry-run" }
      );
      initialStoryboard = storyboardDry.existingStoryboard ?? null;
      const promptDry = await stack.buildScenePackages.dryRun(
        { projectId },
        { correlationId: "page-director-prompts", mode: "dry-run" }
      );
      initialPackageSet = promptDry.existingPackageSet ?? null;
      const routingDry = await stack.routeGenerationPlan.dryRun(
        { projectId },
        { correlationId: "page-director-routing", mode: "dry-run" }
      );
      initialPlanRouting = routingDry.existingPlan ?? null;
    }
  } catch (e) {
    if (e instanceof V2SupabaseConfigError) {
      errorMessage = e.message;
    } else {
      errorMessage = "Erreur serveur lors du chargement du projet.";
    }
  }

  if (errorMessage) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="Projet" subtitle="Réalisateur IA" />
        <p className="text-sm text-[var(--danger)]" role="alert">
          {errorMessage}
        </p>
        <Link href="/director" className="btn btn-ghost mt-4 inline-flex">
          Retour
        </Link>
      </div>
    );
  }

  if (!view || view.status === "not_found") {
    return (
      <div className="max-w-2xl">
        <PageHeader title="Projet introuvable" subtitle="Réalisateur IA" />
        <p className="text-sm text-[var(--muted)]" role="status">
          Aucun projet avec cet identifiant dans le workspace configuré.
        </p>
        <Link href="/director" className="btn btn-ghost mt-4 inline-flex">
          Retour
        </Link>
      </div>
    );
  }

  if (view.status === "invalid_artifact" || view.status === "failed") {
    return (
      <div className="max-w-2xl">
        <PageHeader title="Projet" subtitle="Réalisateur IA" />
        <p className="text-sm text-[var(--danger)]" role="alert">
          {view.publicMessage}
        </p>
        <Link href="/director" className="btn btn-ghost mt-4 inline-flex">
          Retour
        </Link>
      </div>
    );
  }

  const { project, brief } = view.view;

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={project.name}
        subtitle="Projet persisté · Réalisateur IA"
      />

      <p className="text-sm text-[var(--muted)] mb-6">
        Statut {project.status}
        {brief.platform ? ` · ${PLATFORM_LABELS[brief.platform] ?? brief.platform}` : null}
      </p>

      <DirectorProjectClient
        projectId={project.id}
        projectRevision={projectActiveRevision}
        brief={brief}
        initialPlan={initialPlan}
        initialConcept={initialConcept}
        initialScript={initialScript}
        initialVisualDirection={initialVisualDirection}
        initialStoryboard={initialStoryboard}
        initialPackageSet={initialPackageSet}
        initialPlanRouting={initialPlanRouting}
      />

      <div className="mt-6">
        <Link href="/director" className="btn btn-ghost">
          Accueil Réalisateur
        </Link>
      </div>
    </div>
  );
}
