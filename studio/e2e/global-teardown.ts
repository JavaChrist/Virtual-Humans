import { cleanupRuntimeWorkspace } from "./helpers/cleanup";

export default async function globalTeardown() {
  await cleanupRuntimeWorkspace();
}
