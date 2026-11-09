import { describe, expect, it } from 'vitest';
import { segmentReadableText, clampSpeechRate, pickSpeechVoice } from '../../../src/lib/text-to-speech.js';

describe('segmentReadableText', () => {
  it('splits text into sentence units with offsets', () => {
    const text = 'First line. Second line!\n\nThird?';
    expect(segmentReadableText(text, { mode: 'sentence' })).toEqual([
      { text: 'First line.', start: 0, end: 11 },
      { text: 'Second line!', start: 12, end: 24 },
      { text: 'Third?', start: 26, end: 32 },
    ]);
  });

  it('falls back to paragraphs when sentence boundaries are unclear', () => {
    const text = 'A title\n\nA short body';
    expect(segmentReadableText(text, { mode: 'paragraph' })).toEqual([
      { text: 'A title', start: 0, end: 7 },
      { text: 'A short body', start: 9, end: 21 },
    ]);
  });

  it('returns an empty list for blank text', () => {
    expect(segmentReadableText(' \n\n\t')).toEqual([]);
  });
});

describe('speech settings helpers', () => {
  it('clamps playback rate to a supported range', () => {
    expect(clampSpeechRate(0.1)).toBe(0.5);
    expect(clampSpeechRate(1)).toBe(1);
    expect(clampSpeechRate(9)).toBe(2);
  });

  it('prefers the saved voice, then a default/local voice, then the first available voice', () => {
    const voices = [
      { name: 'Remote Voice', lang: 'en-US', default: false, localService: false },
      { name: 'Local Voice', lang: 'en-US', default: true, localService: true },
      { name: 'Saved Voice', lang: 'en-GB', default: false, localService: true },
    ];

    expect(pickSpeechVoice(voices, 'Saved Voice')?.name).toBe('Saved Voice');
    expect(pickSpeechVoice(voices, 'Missing Voice')?.name).toBe('Local Voice');
    expect(pickSpeechVoice([{ name: 'Only Voice', lang: 'en-US' }], '')?.name).toBe('Only Voice');
    expect(pickSpeechVoice([], '')).toBeNull();
  });
});
