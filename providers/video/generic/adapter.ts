import type { ProviderAdapter } from "../../provider.interface";
import type { ProviderMetadata } from "../../provider.types";

export class GenericVideoAdapter implements ProviderAdapter<unknown, unknown> {
  readonly providerId = "generic-video";

  readonly metadata: ProviderMetadata = {
    providerId: "generic-video",
    category: "video",
  };

  validateInput(_input: unknown): void {
    // TODO: implement input validation.
  }

  async generate(_input: unknown): Promise<unknown> {
    throw new Error("Provider adapter not implemented.");
  }
}
