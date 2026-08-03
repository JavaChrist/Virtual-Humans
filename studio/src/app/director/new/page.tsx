import { canUseDirectorV2Persistence } from "@/infrastructure/config/feature-flags";
import { BriefWizard } from "../_components/brief-wizard";

export const dynamic = "force-dynamic";

export default function DirectorNewPage() {
  return <BriefWizard persistenceEnabled={canUseDirectorV2Persistence()} />;
}
