export type TokenCounter = (text: string) => number;

export interface ChunkOptions {
  maxTokens?: number;

overlapTokens?: number;

tokenCounter?: TokenCounter;

respectSentenceBoundaries?: boolean;
}

export interface Chunk {
  text: string;
  startOffset: number;
  endOffset: number;
  tokenCount: number;
  index: number;
}
