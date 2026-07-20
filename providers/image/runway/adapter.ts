import type { ProviderAdapter } from "../../provider.interface";
import type { ProviderMetadata } from "../../provider.types";

export class RunwayImageAdapter implements ProviderAdapter<unknown, unknown> {
  readonly providerId = "runway";

  readonly metadata: ProviderMetadata = {
    providerId: "runway",
    category: "image",
  };

  validateInput(_input: unknown): void {
    // TODO: implement input validation.
  }

  async generate(_input: unknown): Promise<unknown> {
    throw new Error("Provider adapter not implemented.");
  }
}
