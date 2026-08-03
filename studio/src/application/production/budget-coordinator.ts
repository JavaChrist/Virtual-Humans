/**
 * Budget reservation / commit / release orchestration (ports only).
 * Never uses vh_spend. Fallbacks reserved only when executed.
 */

import { money, type Money } from "@/domain/cost";
import { ProductionDomainError } from "@/domain/production";
import type {
  BudgetCommitRequest,
  BudgetReservationPort,
  BudgetReservationRequest,
  BudgetReleaseRequest,
} from "./ports";

export type ReserveAttemptBudgetInput = {
  reservationId: string;
  runId: string;
  sceneId: string;
  stepId: string;
  attemptId: string;
  estimate: Money;
  runCurrency: Money["currency"];
};

export async function reserveAttemptBudget(
  port: BudgetReservationPort,
  input: ReserveAttemptBudgetInput
): Promise<{ reservationId: string; amount: Money }> {
  if (input.estimate.currency !== input.runCurrency) {
    throw new ProductionDomainError(
      "budget_reservation_failed",
      "Devise incompatible pour la réservation."
    );
  }
  const request: BudgetReservationRequest = {
    reservationId: input.reservationId,
    runId: input.runId,
    sceneId: input.sceneId,
    stepId: input.stepId,
    attemptId: input.attemptId,
    amount: input.estimate,
    currency: input.runCurrency,
  };
  const result = await port.reserve(request);
  if (result.status !== "reserved") {
    throw new ProductionDomainError(
      "budget_reservation_failed",
      result.reason || "Réservation budget refusée."
    );
  }
  return { reservationId: result.reservationId, amount: result.amount };
}

/**
 * Commit actual cost when present; otherwise commit provisional = reserved estimate
 * (explicitly marked — never silent real spend).
 * Release unused difference when actual < reserved.
 */
export async function settleAttemptBudget(
  port: BudgetReservationPort,
  input: {
    reservationId: string;
    runId: string;
    sceneId: string;
    stepId: string;
    attemptId: string;
    reserved: Money;
    actualCost?: Money;
  }
): Promise<{ committed: Money; costKind: "actual" | "provisional"; released: Money }> {
  const costKind: "actual" | "provisional" = input.actualCost ? "actual" : "provisional";
  const committedAmount = input.actualCost ?? input.reserved;

  if (committedAmount.currency !== input.reserved.currency) {
    throw new ProductionDomainError(
      "budget_reservation_failed",
      "Devise incompatible au commit."
    );
  }

  const commitReq: BudgetCommitRequest = {
    reservationId: input.reservationId,
    runId: input.runId,
    sceneId: input.sceneId,
    stepId: input.stepId,
    attemptId: input.attemptId,
    amount: committedAmount,
    costKind,
  };
  const committed = await port.commit(commitReq);
  if (committed.status !== "committed") {
    throw new ProductionDomainError(
      "budget_reservation_failed",
      committed.reason || "Commit budget échoué."
    );
  }

  let released = money(0, input.reserved.currency);
  if (committedAmount.amountMinor < input.reserved.amountMinor) {
    const diff = money(
      input.reserved.amountMinor - committedAmount.amountMinor,
      input.reserved.currency
    );
    const releaseReq: BudgetReleaseRequest = {
      reservationId: input.reservationId,
      runId: input.runId,
      sceneId: input.sceneId,
      stepId: input.stepId,
      attemptId: input.attemptId,
      amount: diff,
    };
    const rel = await port.release(releaseReq);
    if (rel.status === "released") {
      released = rel.amount;
    }
  }

  return { committed: committed.amount, costKind, released };
}

export async function releaseFullReservation(
  port: BudgetReservationPort,
  input: {
    reservationId: string;
    runId: string;
    sceneId: string;
    stepId: string;
    attemptId: string;
    amount: Money;
  }
): Promise<Money> {
  const rel = await port.release({
    reservationId: input.reservationId,
    runId: input.runId,
    sceneId: input.sceneId,
    stepId: input.stepId,
    attemptId: input.attemptId,
    amount: input.amount,
  });
  if (rel.status !== "released") {
    throw new ProductionDomainError(
      "budget_reservation_failed",
      rel.reason || "Release budget échoué."
    );
  }
  return rel.amount;
}
