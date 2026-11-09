import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clampSpeechRate, pickSpeechVoice, segmentReadableText } from '../lib/text-to-speech.js';

const VOICE_STORAGE_KEY = 'zuojia-tts-voice';
const RATE_STORAGE_KEY = 'zuojia-tts-rate';

const readStorage = (key, fallback) => {
  try {
    const value = window.localStorage.getItem(key);
    return value == null ? fallback : value;
  } catch {
    return fallback;
  }
};

const writeStorage = (key, value) => {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Ignore storage failures.
  }
};

export function useTextToSpeech({ getText }) {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  const supported = Boolean(synth && typeof window.SpeechSynthesisUtterance === 'function');
  const [voices, setVoices] = useState([]);
  const [voiceName, setVoiceName] = useState(() => readStorage(VOICE_STORAGE_KEY, ''));
  const [rate, setRateState] = useState(() => clampSpeechRate(readStorage(RATE_STORAGE_KEY, 1)));
  const [status, setStatus] = useState('idle'); // idle | playing | paused
  const [activeIndex, setActiveIndex] = useState(-1);
  const [units, setUnits] = useState([]);
  const unitsRef = useRef([]);
  const indexRef = useRef(-1);
  const rateRef = useRef(rate);
  const voiceRef = useRef(null);
  const cancelledRef = useRef(false);

  const selectedVoice = useMemo(() => pickSpeechVoice(voices, voiceName), [voices, voiceName]);
  voiceRef.current = selectedVoice;
  rateRef.current = rate;

  const syncVoices = useCallback(() => {
    if (!synth?.getVoices) return;
    const next = synth.getVoices() || [];
    if (next.length > 0) setVoices(next);
  }, [synth]);

  useEffect(() => {
    if (!supported) return undefined;
    syncVoices();
    synth.addEventListener?.('voiceschanged', syncVoices);
    return () => {
      synth.removeEventListener?.('voiceschanged', syncVoices);
    };
  }, [supported, synth, syncVoices]);

  useEffect(() => {
    if (selectedVoice?.name) writeStorage(VOICE_STORAGE_KEY, selectedVoice.name);
  }, [selectedVoice]);

  const setRate = useCallback((nextRate) => {
    const clamped = clampSpeechRate(nextRate);
    setRateState(clamped);
    writeStorage(RATE_STORAGE_KEY, clamped);
  }, []);

  const clearPlayback = useCallback((nextStatus = 'idle') => {
    cancelledRef.current = true;
    synth?.cancel?.();
    cancelledRef.current = false;
    indexRef.current = -1;
    unitsRef.current = [];
    setUnits([]);
    setActiveIndex(-1);
    setStatus(nextStatus);
  }, [synth]);

  useEffect(() => () => clearPlayback('idle'), [clearPlayback]);

  const speakIndex = useCallback((index, nextUnits = unitsRef.current) => {
    if (!supported || !synth) return;
    const unit = nextUnits[index];
    if (!unit) {
      clearPlayback('idle');
      return;
    }

    cancelledRef.current = false;
    synth.cancel();
    const utterance = new window.SpeechSynthesisUtterance(unit.text);
    utterance.rate = rateRef.current;
    if (voiceRef.current) utterance.voice = voiceRef.current;
    utterance.onstart = () => {
      indexRef.current = index;
      setActiveIndex(index);
      setStatus('playing');
    };
    utterance.onend = () => {
      if (cancelledRef.current) return;
      speakIndex(index + 1, nextUnits);
    };
    utterance.onerror = () => {
      if (cancelledRef.current) return;
      clearPlayback('idle');
    };
    synth.speak(utterance);
  }, [supported, synth, clearPlayback]);

  const play = useCallback(() => {
    if (!supported) return;
    if (status === 'paused' && synth?.paused) {
      synth.resume();
      setStatus('playing');
      return;
    }
    const text = typeof getText === 'function' ? String(getText() || '') : '';
    const nextUnits = segmentReadableText(text, { mode: 'sentence' });
    if (nextUnits.length === 0) return;
    unitsRef.current = nextUnits;
    setUnits(nextUnits);
    speakIndex(0, nextUnits);
  }, [supported, status, synth, getText, speakIndex]);

  const pause = useCallback(() => {
    if (!supported || status !== 'playing') return;
    synth?.pause?.();
    setStatus('paused');
  }, [supported, status, synth]);

  const resume = useCallback(() => {
    if (!supported || status !== 'paused') return;
    synth?.resume?.();
    setStatus('playing');
  }, [supported, status, synth]);

  const stop = useCallback(() => {
    if (!supported) return;
    clearPlayback('idle');
  }, [supported, clearPlayback]);

  const navigate = useCallback((delta) => {
    if (!supported || unitsRef.current.length === 0) return;
    const base = indexRef.current >= 0 ? indexRef.current : 0;
    const nextIndex = Math.min(unitsRef.current.length - 1, Math.max(0, base + delta));
    speakIndex(nextIndex, unitsRef.current);
  }, [supported, speakIndex]);

  return {
    supported,
    status,
    voices,
    voiceName: selectedVoice?.name || '',
    setVoiceName,
    rate,
    setRate,
    units,
    activeIndex,
    activeUnit: activeIndex >= 0 ? units[activeIndex] : null,
    play,
    pause,
    resume,
    stop,
    next: () => navigate(1),
    previous: () => navigate(-1),
  };
}
