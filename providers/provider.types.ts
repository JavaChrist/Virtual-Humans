export type ProviderCategory = "image" | "video" | "voice";

export interface ProviderMetadata {
  providerId: string;
  category: ProviderCategory;
  model?: string;
}
