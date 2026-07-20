import type { ProviderAdapter } from "../../provider.interface";
import type { ProviderMetadata } from "../../provider.types";

export class KlingVideoAdapter implements ProviderAdapter<unknown, unknown> {
  readonly providerId = "kling";

  readonly metadata: ProviderMetadata = {
    providerId: "kling",
    category: "video",
  };

  validateInput(_input: unknown): void {
    // TODO: implement input validation.
  }

  async generate(_input: unknown): Promise<unknown> {
    throw new Error("Provider adapter not implemented.");
  }
}
