import { chunkText, defaultTokenCounter } from '../src/index';

const wordCounter = (t: string): number => {
const trimmed = t.trim();
return trimmed ? trimmed.split(/\s+/).length : 0;
};

const NUMS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const longText = NUMS.map((n) => `Sentence number ${n} is here.`).join(' ');

describe('chunkText — edge cases', () => {
test('returns [] for empty string', () => {
expect(chunkText('')).toEqual([]);
});

test('returns [] for whitespace-only string', () => {
expect(chunkText('   \n\n  \t ')).toEqual([]);
});

test('works with no options object (all defaults)', () => {
const chunks = chunkText('Just a short sentence.');
expect(chunks).toHaveLength(1);
expect(chunks[0].text).toBe('Just a short sentence.');
expect(chunks[0].index).toBe(0);
});
});

describe('defaultTokenCounter', () => {
test('treats empty/whitespace-only text as 0 tokens', () => {
expect(defaultTokenCounter('')).toBe(0);
expect(defaultTokenCounter('   ')).toBe(0);
});

test('estimates roughly 4 characters per token', () => {
expect(defaultTokenCounter('abcd')).toBe(1);
expect(defaultTokenCounter('a'.repeat(9))).toBe(3);
});
});

describe('chunkText — short text', () => {
test('short text fits in a single chunk with correct metadata', () => {
const text = 'Hello world. This is short.';
const chunks = chunkText(text, { maxTokens: 500 });
expect(chunks).toHaveLength(1);
expect(chunks[0]).toMatchObject({
text,
startOffset: 0,
endOffset: text.length,
index: 0,
});
expect(chunks[0].tokenCount).toBe(defaultTokenCounter(text));
});
});

describe('chunkText — long text, default token counter', () => {
const text = 'The quick brown fox jumps over the lazy dog. '.repeat(60).trim();

test('produces multiple chunks, each within maxTokens', () => {
const chunks = chunkText(text, { maxTokens: 500 });
expect(chunks.length).toBeGreaterThan(1);
for (const chunk of chunks) {
expect(chunk.tokenCount).toBeLessThanOrEqual(500);
}
});

test('chunks reconstruct their own slice of the original text', () => {
const chunks = chunkText(text, { maxTokens: 500 });
for (const chunk of chunks) {
expect(text.slice(chunk.startOffset, chunk.endOffset)).toBe(chunk.text);
}
});
});

describe('chunkText — long text, custom word counter, no overlap', () => {
test('packs exactly two 5-word sentences per chunk (10-word cap)', () => {
const chunks = chunkText(longText, { maxTokens: 10, overlapTokens: 0, tokenCounter: wordCounter });
expect(chunks).toHaveLength(5);
chunks.forEach((chunk) => {
expect(chunk.tokenCount).toBe(10);
expect(chunk.text.trim().endsWith('.')).toBe(true);
});
});

test('chunks are contiguous (no gap, no overlap) when overlapTokens is 0', () => {
const chunks = chunkText(longText, { maxTokens: 10, overlapTokens: 0, tokenCounter: wordCounter });
for (let i = 0; i < chunks.length - 1; i++) {
expect(chunks[i + 1].startOffset).toBe(chunks[i].endOffset);
}
});
});

describe('chunkText — overlap correctness', () => {
const chunks = chunkText(longText, { maxTokens: 10, overlapTokens: 5, tokenCounter: wordCounter });

test('produces one chunk per consecutive sentence pair (sliding window of 2)', () => {
expect(chunks).toHaveLength(9);
});

test('each chunk contains the expected sentence pair', () => {
chunks.forEach((chunk, i) => {
expect(chunk.text).toContain(NUMS[i]);
expect(chunk.text).toContain(NUMS[i + 1]);
expect(chunk.tokenCount).toBe(10);
});
});

test('consecutive chunks overlap by exactly one sentence', () => {
for (let i = 0; i < chunks.length - 1; i++) {
expect(chunks[i + 1].startOffset).toBeLessThan(chunks[i].endOffset);
const overlapText = longText.slice(chunks[i + 1].startOffset, chunks[i].endOffset);
expect(overlapText).toContain(NUMS[i + 1]);
expect(wordCounter(overlapText)).toBe(5);
}
});

test('every chunk reconstructs correctly from startOffset/endOffset', () => {
for (const chunk of chunks) {
expect(longText.slice(chunk.startOffset, chunk.endOffset)).toBe(chunk.text);
}
});

test('index increments sequentially from 0', () => {
chunks.forEach((chunk, i) => expect(chunk.index).toBe(i));
});

test('tokenCount always matches tokenCounter(chunk.text)', () => {
chunks.forEach((chunk) => expect(chunk.tokenCount).toBe(wordCounter(chunk.text)));
});
});

describe('chunkText — sentence boundary respecting vs not', () => {
test('respectSentenceBoundaries: true keeps every chunk ending on sentence punctuation', () => {
const chunks = chunkText(longText, {
maxTokens: 7,
overlapTokens: 0,
tokenCounter: wordCounter,
respectSentenceBoundaries: true,
});
chunks.forEach((chunk) => {
expect(/[.!?]$/.test(chunk.text.trim())).toBe(true);
});
});

test('respectSentenceBoundaries: false can cut mid-sentence', () => {
const chunks = chunkText(longText, {
maxTokens: 7,
overlapTokens: 0,
tokenCounter: wordCounter,
respectSentenceBoundaries: false,
});
expect(/[.!?]$/.test(chunks[0].text.trim())).toBe(false);
expect(chunks[0].text.trim()).toBe('Sentence number one is here. Sentence number');
});
});

describe('chunkText — paragraph boundaries', () => {
const text =
'Para one sentence one. Para one sentence two.\n\nPara two sentence one. Para two sentence two.';

test('keeps each paragraph in its own chunk when it does not fit combined', () => {
const chunks = chunkText(text, { maxTokens: 8, overlapTokens: 0, tokenCounter: wordCounter });
expect(chunks).toHaveLength(2);
expect(chunks[0].text).not.toContain('Para two');
expect(chunks[1].text).not.toContain('Para one');
});

test('the paragraph-break gap between chunks is preserved but not double-counted', () => {
const chunks = chunkText(text, { maxTokens: 8, overlapTokens: 0, tokenCounter: wordCounter });
const gap = text.slice(chunks[0].endOffset, chunks[1].startOffset);
expect(gap).toBe('\n\n');
});
});

describe('chunkText — oversized single sentence', () => {
test('falls back to word-splitting a sentence longer than maxTokens instead of throwing', () => {
const words = Array.from({ length: 20 }, (_, i) => `word${i + 1}`);
const oneGiantSentence = words.join(' ') + '.';
const chunks = chunkText(oneGiantSentence, {
maxTokens: 5,
overlapTokens: 0,
tokenCounter: wordCounter,
respectSentenceBoundaries: true,
});
expect(chunks.length).toBeGreaterThan(1);
chunks.forEach((chunk) => expect(chunk.tokenCount).toBeLessThanOrEqual(5));
expect(oneGiantSentence.slice(chunks[0].startOffset, chunks[chunks.length - 1].endOffset)).toBe(
oneGiantSentence
);
});
});

describe('chunkText — custom token counter injection', () => {
test('invokes the provided tokenCounter and uses it to decide boundaries', () => {
const spy = jest.fn((t: string) => t.length);
const text = 'aaaa bbbb cccc dddd';
const chunks = chunkText(text, { maxTokens: 9, overlapTokens: 0, tokenCounter: spy });
expect(spy).toHaveBeenCalled();
expect(chunks[0].text).toBe('aaaa bbbb');
});
});

describe('chunkText — option validation', () => {
test('throws if maxTokens is not positive', () => {
expect(() => chunkText('abc', { maxTokens: 0 })).toThrow();
expect(() => chunkText('abc', { maxTokens: -5 })).toThrow();
});

test('throws if overlapTokens is negative', () => {
expect(() => chunkText('abc', { overlapTokens: -1 })).toThrow();
});

test('throws if overlapTokens >= maxTokens', () => {
expect(() => chunkText('abc', { maxTokens: 10, overlapTokens: 10 })).toThrow();
expect(() => chunkText('abc', { maxTokens: 10, overlapTokens: 20 })).toThrow();
});
});

describe('chunkText — stress: maxTokens of 1', () => {
test('produces one chunk per word without hanging, when boundaries are not respected', () => {
const chunks = chunkText(longText, {
maxTokens: 1,
overlapTokens: 0,
tokenCounter: wordCounter,
respectSentenceBoundaries: false,
});
const totalWords = wordCounter(longText);
expect(chunks).toHaveLength(totalWords);
chunks.forEach((chunk) => expect(chunk.tokenCount).toBe(1));
});
});
