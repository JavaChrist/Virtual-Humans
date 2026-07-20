import type { ProviderAdapter } from "../../provider.interface";
import type { ProviderMetadata } from "../../provider.types";

export class ElevenLabsVoiceAdapter implements ProviderAdapter<unknown, unknown> {
  readonly providerId = "elevenlabs";

  readonly metadata: ProviderMetadata = {
    providerId: "elevenlabs",
    category: "voice",
  };

  validateInput(_input: unknown): void {
    // TODO: implement input validation.
  }

  async generate(_input: unknown): Promise<unknown> {
    throw new Error("Provider adapter not implemented.");
  }
}
