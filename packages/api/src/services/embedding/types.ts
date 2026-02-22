export interface EmbeddingProviderInterface {
  readonly name: string;
  readonly model: string;
  generateEmbedding(text: string): Promise<number[]>;
  isAvailable(): Promise<boolean>;
}
