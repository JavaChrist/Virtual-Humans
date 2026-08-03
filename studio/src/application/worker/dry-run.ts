/**
 * Worker dry-run — validate wiring without claim, reserve, or provider calls (VHS-114).
 */

import type { JobQueuePort } from "@/application/production/enqueue";
import type { ProductionDirector } from "@/application/production/production-director";
import type { GenerationEngine } from "@/application/generation";
import type { ProductionPorts } from "@/application/production/ports";
import type { FeatureFlagsSnapshot } from "@/infrastructure/config/feature-flags";
import type { WorkerPolicy } from "./policy";
import { validateWorkerPolicy } from "./policy";

export type WorkerDryRunValidation = {
  code: string;
  passed: boolean;
  message: string;
};

export type WorkerDryRunResult = {
  ready: boolean;
  providerCalled: false;
  validations: WorkerDryRunValidation[];
  flags: FeatureFlagsSnapshot;
};

export type WorkerDryRunInput = {
  policy: WorkerPolicy;
  flags: FeatureFlagsSnapshot;
  queue?: JobQueuePort | null;
  director?: ProductionDirector | null;
  engine?: GenerationEngine | null;
  ports?: Partial<ProductionPorts> | null;
  /** When true, require durable idempotency port. */
  requireDurableIdempotency?: boolean;
  /** Optional fixture job — never claimed from real queue. */
  hasPeekOrFixture?: boolean;
};

export function runWorkerDryRun(input: WorkerDryRunInput): WorkerDryRunResult {
  const validations: WorkerDryRunValidation[] = [];
  let ready = true;

  const push = (code: string, passed: boolean, message: string) => {
    validations.push({ code, passed, message });
    if (!passed) ready = false;
  };

  try {
    validateWorkerPolicy(input.policy);
    push("policy", true, "Politique worker valide.");
  } catch (e) {
    push("policy", false, e instanceof Error ? e.message : "Politique invalide.");
  }

  push(
    "worker_flag",
    true,
    input.flags.directorV2Worker
      ? "DIRECTOR_V2_WORKER_ENABLED on (dry-run only — no claim)."
      : "DIRECTOR_V2_WORKER_ENABLED off."
  );

  if (!input.flags.directorV2PaidGeneration) {
    push(
      "paid_flag",
      true,
      "DIRECTOR_V2_PAID_GENERATION_ENABLED off — aucun provider (attendu en dry-run)."
    );
  } else {
    push(
      "paid_flag",
      true,
      "Paid generation on — dry-run refuse toujours les appels provider."
    );
  }

  push(
    "queue",
    Boolean(input.queue),
    input.queue ? "JobQueuePort présent." : "JobQueuePort absent."
  );
  push(
    "director",
    Boolean(input.director),
    input.director ? "Production Director présent." : "Production Director absent."
  );
  push(
    "engine",
    Boolean(input.engine),
    input.engine ? "Generation Engine présent." : "Generation Engine absent."
  );

  const ports = input.ports;
  push(
    "run_store",
    Boolean(ports?.runStore),
    ports?.runStore ? "Run store présent." : "Run store absent."
  );
  push(
    "budget",
    Boolean(ports?.budget),
    ports?.budget ? "Budget port présent." : "Budget port absent."
  );

  if (input.requireDurableIdempotency !== false) {
    const durable = ports?.idempotency?.durable === true;
    push(
      "idempotency_durable",
      durable,
      durable
        ? "Idempotence durable configurée."
        : "Store d'idempotence non durable ou absent."
    );
  }

  push(
    "events",
    Boolean(ports?.events),
    ports?.events ? "Event port présent." : "Event port absent."
  );

  if (input.hasPeekOrFixture === false) {
    push(
      "no_claim",
      true,
      "Aucun peek/fixture — dry-run ne claim pas de job réel."
    );
  }

  push("provider_calls", true, "providerCalled=false (garanti).");

  return {
    ready,
    providerCalled: false,
    validations,
    flags: input.flags,
  };
}
