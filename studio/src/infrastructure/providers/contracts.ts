/**
 * Injectable low-level client ports (VHS-109).
 * Production wires existing helpers; tests use fakes — no real network.
 */

export type FalQueueSubmitResult = { requestId: string };

export type FalQueueStatusResult = {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | string;
  videoUrl?: string;
  imageUrl?: string;
  error?: string;
};

export type FalClientPort = {
  submitJob(model: string, input: Record<string, unknown>): Promise<string>;
  checkJob(model: string, requestId: string): Promise<FalQueueStatusResult>;
  /** Sync identity image (flux-pulid subscribe). */
  generateIdentityImage?(
    referenceImageUrl: string,
    prompt: string,
    imageSize?: string,
  ): Promise<string>;
};

export type OpenAIImageClientPort = {
  generateImage(opts: {
    prompt: string;
    size: "1024x1024" | "1024x1536" | "1536x1024";
    quality: "low" | "medium" | "high";
  }): Promise<{ dataUrl: string; size: string; quality: string }>;
};

export type ElevenLabsVoiceClientPort = {
  generateVoice(opts: {
    text: string;
    voiceId?: string;
    modelId?: string;
  }): Promise<{ dataUrl: string; mime: string }>;
};
