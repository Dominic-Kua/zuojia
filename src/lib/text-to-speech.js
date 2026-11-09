const MIN_SPEECH_RATE = 0.5;
const MAX_SPEECH_RATE = 2;

const trimSegment = (text, start, end) => {
  let left = start;
  let right = end;
  while (left < right && /\s/.test(text[left])) left += 1;
  while (right > left && /\s/.test(text[right - 1])) right -= 1;
  if (right <= left) return null;
  return { text: text.slice(left, right), start: left, end: right };
};

const segmentParagraphs = (text) => {
  const segments = [];
  const parts = text.split(/\n\s*\n+/g);
  let cursor = 0;

  parts.forEach((part) => {
    const index = text.indexOf(part, cursor);
    const start = index === -1 ? cursor : index;
    const segment = trimSegment(text, start, start + part.length);
    if (segment) segments.push(segment);
    cursor = start + part.length;
  });

  return segments;
};

const segmentSentences = (text) => {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' });
    const segments = [];
    for (const { segment, index } of segmenter.segment(text)) {
      const trimmed = trimSegment(text, index, index + segment.length);
      if (trimmed) segments.push(trimmed);
    }
    if (segments.length > 0) return segments;
  }

  // Fallback: split after sentence punctuation while preserving offsets.
  const segments = [];
  const regex = /[^.!?\n]+[.!?]+(?=\s|$)|[^.!?\n]+$/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const trimmed = trimSegment(text, match.index, match.index + match[0].length);
    if (trimmed) segments.push(trimmed);
  }
  return segments.length > 0 ? segments : segmentParagraphs(text);
};

export const segmentReadableText = (text, { mode = 'sentence' } = {}) => {
  if (typeof text !== 'string' || text.trim() === '') return [];
  return mode === 'paragraph' ? segmentParagraphs(text) : segmentSentences(text);
};

export const clampSpeechRate = (rate) => {
  const value = Number(rate);
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_SPEECH_RATE, Math.max(MIN_SPEECH_RATE, value));
};

export const pickSpeechVoice = (voices, preferredName = '') => {
  if (!Array.isArray(voices) || voices.length === 0) return null;
  if (preferredName) {
    const preferred = voices.find((voice) => voice?.name === preferredName);
    if (preferred) return preferred;
  }

  const localDefault = voices.find((voice) => voice?.default && voice?.localService);
  if (localDefault) return localDefault;
  const anyDefault = voices.find((voice) => voice?.default);
  if (anyDefault) return anyDefault;
  const localEnglish = voices.find((voice) => voice?.localService && /^en\b/i.test(voice?.lang || ''));
  if (localEnglish) return localEnglish;
  return voices[0];
};

export const getSpeechSelectionText = (selection, root) => {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return '';
  const range = selection.getRangeAt(0);
  if (root && !root.contains(range.commonAncestorContainer)) return '';
  return String(selection.toString() || '').trim();
};
