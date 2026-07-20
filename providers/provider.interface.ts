export interface ProviderAdapter<TInput, TOutput> {
  readonly providerId: string;
  validateInput(input: TInput): void;
  generate(input: TInput): Promise<TOutput>;
}
