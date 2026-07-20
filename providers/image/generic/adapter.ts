import type { ProviderAdapter } from "../../provider.interface";
import type { ProviderMetadata } from "../../provider.types";

export class GenericImageAdapter implements ProviderAdapter<unknown, unknown> {
  readonly providerId = "generic-image";

  readonly metadata: ProviderMetadata = {
    providerId: "generic-image",
    category: "image",
  };

  validateInput(_input: unknown): void {
    // TODO: implement input validation.
  }

  async generate(_input: unknown): Promise<unknown> {
    throw new Error("Provider adapter not implemented.");
  }
}
