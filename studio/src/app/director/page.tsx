import { canUseDirectorV2Persistence } from "@/infrastructure/config/feature-flags";
import { createDirectorPersistenceStack } from "@/infrastructure/db/director-server";
import { V2SupabaseConfigError } from "@/infrastructure/db/supabase-server";
import { logger } from "@/infrastructure/observability";
import { DirectorHome } from "./_components/director-home";
import type { DirectorProjectListItem } from "@/application/projects/list-director-projects";

export const dynamic = "force-dynamic";

export default async function DirectorPage() {
  const persistenceEnabled = canUseDirectorV2Persistence();
  let recentProjects: DirectorProjectListItem[] = [];
  let listError: string | null = null;

  if (persistenceEnabled) {
    try {
      const stack = createDirectorPersistenceStack();
      const result = await stack.listProjects.execute(20);
      if (result.status === "ok") {
        recentProjects = result.items;
        logger.info(
          "director.project.listed",
          {
            correlationId: "page-director-home",
            route: "/director",
            operation: "director.project.listed",
          },
          { count: result.items.length }
        );
      } else {
        listError = result.publicMessage;
      }
    } catch (e) {
      listError =
        e instanceof V2SupabaseConfigError
          ? e.message
          : "Impossible de charger les projets récents.";
    }
  }

  return (
    <DirectorHome
      persistenceEnabled={persistenceEnabled}
      recentProjects={recentProjects}
      listError={listError}
    />
  );
}
