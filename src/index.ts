import type { Chunk, ChunkOptions, TokenCounter } from './types';

export * from './types';

const DEFAULT_MAX_TOKENS = 500;
const DEFAULT_OVERLAP_TOKENS = 0;

interface Segment {
text: string;
start: number;
end: number;
}

export function defaultTokenCounter(text: string): number {
const trimmed = text.trim();
if (!trimmed) return 0;
return Math.max(1, Math.ceil(trimmed.length / 4));
}

function splitIntoParagraphs(text: string): Segment[] {
const segments: Segment[] = [];
const regex = /\n{2,}/g;
let start = 0;
let match: RegExpExecArray | null;
while ((match = regex.exec(text))) {
if (match.index > start) {
segments.push({ text: text.slice(start, match.index), start, end: match.index });
}
start = match.index + match[0].length;
}
if (start < text.length) {
segments.push({ text: text.slice(start), start, end: text.length });
}
return segments;
}

function splitIntoSentenceSegments(text: string, offset: number): Segment[] {
const segments: Segment[] = [];
const regex = /[.!?]+(?=\s|$)/g;
let start = 0;
let match: RegExpExecArray | null;
while ((match = regex.exec(text))) {
const end = match.index + match[0].length;
segments.push({ text: text.slice(start, end), start: offset + start, end: offset + end });
start = end;
}
if (start < text.length) {
segments.push({ text: text.slice(start), start: offset + start, end: offset + text.length });
}
return segments.filter((s) => s.text.length > 0);
}

function splitIntoWordSegments(text: string, offset: number): Segment[] {
const segments: Segment[] = [];
const regex = /\S+/g;
let match: RegExpExecArray | null;
while ((match = regex.exec(text))) {
segments.push({ text: match[0], start: offset + match.index, end: offset + match.index + match[0].length });
}
return segments;
}

function buildSegments(
text: string,
respectSentenceBoundaries: boolean,
tokenCounter: TokenCounter,
maxTokens: number
): Segment[] {
if (!respectSentenceBoundaries) {
return splitIntoWordSegments(text, 0);
}

const segments: Segment[] = [];
for (const paragraph of splitIntoParagraphs(text)) {
for (const sentence of splitIntoSentenceSegments(paragraph.text, paragraph.start)) {
if (tokenCounter(sentence.text) > maxTokens) {
segments.push(...splitIntoWordSegments(sentence.text, sentence.start));
} else {
segments.push(sentence);
}
}
}
return segments;
}

export function chunkText(text: string, options: ChunkOptions = {}): Chunk[] {
const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
const overlapTokens = options.overlapTokens ?? DEFAULT_OVERLAP_TOKENS;
const tokenCounter = options.tokenCounter ?? defaultTokenCounter;
const respectSentenceBoundaries = options.respectSentenceBoundaries ?? true;

if (!Number.isFinite(maxTokens) || maxTokens <= 0) {
throw new Error('chunkText: options.maxTokens must be a positive number');
}
if (!Number.isFinite(overlapTokens) || overlapTokens < 0) {
throw new Error('chunkText: options.overlapTokens must not be negative');
}
if (overlapTokens >= maxTokens) {
throw new Error('chunkText: options.overlapTokens must be less than options.maxTokens');
}

if (!text || !text.trim()) return [];

const segments = buildSegments(text, respectSentenceBoundaries, tokenCounter, maxTokens);
if (segments.length === 0) return [];

const chunks: Chunk[] = [];
let carrySegments: Segment[] = [];
let i = 0;

while (i < segments.length) {
const iStart = i;
let current: Segment[] = [...carrySegments];
let chunkStartOffset = current.length > 0 ? current[0].start : segments[i].start;

while (i < segments.length) {
const seg = segments[i];
const candidateText = text.slice(chunkStartOffset, seg.end);
const candidateTokens = tokenCounter(candidateText);
if (current.length === 0 || candidateTokens <= maxTokens) {
current.push(seg);
i++;
} else {
break;
}
}

if (i === iStart) {
current = [segments[i]];
chunkStartOffset = segments[i].start;
i++;
}

const chunkEndOffset = current[current.length - 1].end;
const chunkTextStr = text.slice(chunkStartOffset, chunkEndOffset);
chunks.push({
text: chunkTextStr,
startOffset: chunkStartOffset,
endOffset: chunkEndOffset,
tokenCount: tokenCounter(chunkTextStr),
index: chunks.length,
});

carrySegments = [];
if (overlapTokens > 0 && i < segments.length) {
for (let j = current.length - 1; j >= 0; j--) {
const candidate = [current[j], ...carrySegments];
const candidateText = text.slice(candidate[0].start, chunkEndOffset);
if (tokenCounter(candidateText) <= overlapTokens) {
carrySegments = candidate;
} else {
break;
}
}
}
}

return chunks;
}
