# chunk-lite

Token-aware text chunking for RAG (retrieval-augmented generation) pipelines. Splits long text into chunks sized for embedding, with configurable overlap and sentence/paragraph-boundary awareness — so it avoids cutting mid-sentence when it reasonably can.

No hard dependency on any specific LLM's tokenizer: the default token counter is a simple character-length heuristic, but you can plug in a real tokenizer (`tiktoken`, a model's own counting endpoint, whatever) via `tokenCounter`.

## Install

```bash
npm install chunk-lite
```

## Quick start

```ts
import { chunkText } from 'chunk-lite';

const chunks = chunkText(longDocument, {
maxTokens: 300,
overlapTokens: 50,
});

chunks[0];
// {
//   text: "...",
//   startOffset: 0,
//   endOffset: 1180,
//   tokenCount: 298,
//   index: 0,
// }
```

Each chunk carries `startOffset`/`endOffset` into the original string, so you can trace a retrieved chunk back to its source location (for citations, highlighting, or re-fetching surrounding context).

## RAG pipeline example

```ts
import { chunkText } from 'chunk-lite';
import { embed } from './my-embeddings-client';

async function indexDocument(docId: string, text: string) {
const chunks = chunkText(text, { maxTokens: 400, overlapTokens: 40 });

for (const chunk of chunks) {
const vector = await embed(chunk.text);
await vectorStore.upsert({
id: `${docId}:${chunk.index}`,
vector,
metadata: {
docId,
startOffset: chunk.startOffset,
endOffset: chunk.endOffset,
text: chunk.text,
},
});
}
}
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `maxTokens` | `number` | `500` | Maximum tokens per chunk, per the active token counter |
| `overlapTokens` | `number` | `0` | Tokens of overlap between consecutive chunks (must be `< maxTokens`) |
| `tokenCounter` | `(text: string) => number` | char-length heuristic | Pluggable token counter — pass a real tokenizer for exact counts |
| `respectSentenceBoundaries` | `boolean` | `true` | Align chunk boundaries to sentence/paragraph endings where possible |

## Pluggable tokenizer

The default `tokenCounter` estimates ~4 characters per token, which is dependency-free and good enough for rough sizing. If you need exact counts for a specific model, pass your own:

```ts
import { chunkText } from 'chunk-lite';
import { encoding_for_model } from 'tiktoken';

const enc = encoding_for_model('gpt-4o');
const tiktokenCounter = (text: string) => enc.encode(text).length;

const chunks = chunkText(longDocument, {
maxTokens: 800,
overlapTokens: 100,
tokenCounter: tiktokenCounter,
});
```

This keeps `chunk-lite` itself at zero required dependencies — you only pay for a tokenizer library if you actually need one.

## Sentence/paragraph boundary awareness

By default (`respectSentenceBoundaries: true`), chunks are packed sentence-by-sentence and won't split a sentence across two chunks unless a single sentence alone exceeds `maxTokens` (in which case it falls back to word boundaries just for that sentence, since it can't fit as one unit regardless). Paragraph breaks (`\n\n`) are also respected as natural grouping points.

Set `respectSentenceBoundaries: false` for raw token-count packing at word boundaries — slightly denser chunks, at the cost of occasionally cutting a sentence in half.

## Why offsets, not just text

Returning `startOffset`/`endOffset` alongside `text` means you can always re-derive the chunk from the source (`text.slice(startOffset, endOffset) === chunk.text`), trace retrieved chunks back to their location for citation/highlighting, and re-chunk with different settings without losing the ability to compare against the original.

See [`CASE_STUDY.md`](./CASE_STUDY.md) for the reasoning behind chunk boundaries, overlap trade-offs, and why this doesn't depend on a specific tokenizer library.

## License

MIT
