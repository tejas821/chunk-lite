# chunk-lite — design case study

## The problem

Every RAG pipeline starts the same way: take a long document, split it into pieces small enough to embed and retrieve individually, and hope the split points don't destroy the meaning of what's inside each piece. That last part is where most naive implementations go wrong — a fixed-size character or token split has no idea where a sentence, an argument, or a code block actually ends, so it happily cuts a chunk in half mid-thought.

That matters more than it sounds like it should. An embedding model encodes whatever text it's given, including a chunk that starts "...and that's why the deadline was moved" with no antecedent for "that." The embedding for that chunk is now a blurry average of two unrelated ideas, and it retrieves worse for both of them. Chunk boundary quality is a retrieval-quality problem before it's ever a generation-quality problem — by the time a bad chunk reaches the LLM, the damage (missing or noisy context) is already done.

`chunk-lite` exists to make the boundary-aware version the default, not something every team re-implements from scratch — the same motivation behind the rest of this `-lite` series, just applied to the first genuinely AI/RAG-shaped problem in it.

## Why sentence/paragraph boundaries by default

Packing chunks sentence-by-sentence (falling back to word boundaries only when a single sentence alone exceeds `maxTokens`) costs a little chunk-size uniformity — chunks land at roughly `maxTokens`, not exactly — in exchange for every chunk being a coherent unit of text on its own. For retrieval, "roughly the right size but always complete thoughts" beats "exactly the right size but sometimes fragments" almost every time, because the embedding quality of a fragment degrades faster than the retrieval quality lost to a slightly-under-budget chunk.

`respectSentenceBoundaries: false` still exists, deliberately, for cases where uniform chunk size matters more than boundary purity — bulk indexing jobs where you're optimizing for predictable embedding-call batching, for instance.

## Why overlap is configurable, not automatic

Overlap (`overlapTokens`) exists to prevent a fact from being invisible to retrieval just because it happened to fall at a chunk boundary — if the sentence containing the answer is split so that half its supporting context is in the previous chunk, overlap gives the next chunk a fighting chance of still retrieving well.

But overlap isn't free: it multiplies embedding calls and storage (10-20% overlap roughly means 10-20% more chunks to embed and store for the same document), and past a point it just re-indexes the same content redundantly without improving recall. There's no universally correct overlap percentage — it depends on how self-contained your source documents' sentences tend to be — so `chunk-lite` defaults to `0` and leaves the trade-off explicit rather than picking a number that would be wrong for a meaningful fraction of use cases.

## Why offsets are part of the return value

A chunk of text alone is retrieval-ready but not much else. Returning `startOffset`/`endOffset` alongside `text` means the caller can always trace a retrieved chunk back to exactly where it came from in the source document — for citation UI, for expanding the retrieved context by re-slicing a wider window around the offsets, or for re-chunking with different settings later without losing the mapping back to the original. It's a small addition that costs nothing at chunk time and removes a whole category of "where did this text actually come from" bugs downstream.

## Why not depend on a specific tokenizer library

Tying a chunking utility to one tokenizer (`tiktoken`, a specific model's tokenizer, etc.) makes it wrong the moment someone uses a different model — token boundaries genuinely differ between tokenizers, so a chunk sized correctly for one model's context window can silently be too large for another's. `chunk-lite` instead takes a `tokenCounter` function and ships a dependency-free default (a ~4-characters-per-token heuristic, a reasonable approximation across most English-text tokenizers for sizing purposes). Anyone who needs exact counts for a specific model passes their own counter — the package stays at zero required runtime dependencies either way, and works the same whether you're targeting GPT, Claude, or a local model with its own tokenizer.

## What's next

Fifth entry in the series, and the first with a direct applied-AI angle — the natural next step from here is something on the retrieval or embedding-management side, still framework-agnostic and dependency-light in the same spirit as the rest of the series.
