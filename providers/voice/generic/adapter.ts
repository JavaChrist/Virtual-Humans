import type { ProviderAdapter } from "../../provider.interface";
import type { ProviderMetadata } from "../../provider.types";

export class GenericVoiceAdapter implements ProviderAdapter<unknown, unknown> {
  readonly providerId = "generic-voice";

  readonly metadata: ProviderMetadata = {
    providerId: "generic-voice",
    category: "voice",
  };

  validateInput(_input: unknown): void {
    // TODO: implement input validation.
  }

  async generate(_input: unknown): Promise<unknown> {
    throw new Error("Provider adapter not implemented.");
  }
}
