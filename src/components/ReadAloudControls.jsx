import React from 'react';
import { useTextToSpeech } from '../hooks/useTextToSpeech.js';

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 1.75, 2];

export default function ReadAloudControls({ getText, onActiveUnitChange }) {
  const speech = useTextToSpeech({ getText });
  const { activeUnit, status } = speech;

  React.useEffect(() => {
    onActiveUnitChange?.(activeUnit, speech.activeIndex, speech.units.length, status);
  }, [activeUnit, speech.activeIndex, speech.units.length, status, onActiveUnitChange]);

  React.useEffect(() => () => {
    onActiveUnitChange?.(null, -1, 0, 'idle');
  }, [onActiveUnitChange]);

  if (!speech.supported) {
    return (
      <div className="read-aloud" data-testid="read-aloud-controls">
        <span className="read-aloud-label">Read aloud</span>
        <span className="read-aloud-unsupported" data-testid="read-aloud-unsupported">
          Text-to-speech is not available in this window.
        </span>
      </div>
    );
  }

  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';
  const isActive = isPlaying || isPaused;

  return (
    <div className="read-aloud" data-testid="read-aloud-controls" aria-label="Read aloud controls">
      <span className="read-aloud-label">Read aloud</span>
      <div className="read-aloud-actions">
        {!isPlaying ? (
          <button type="button" className="btn ghost btn-sm" data-testid="read-aloud-play" onClick={speech.play}>
            {isPaused ? 'Resume' : 'Play'}
          </button>
        ) : (
          <button type="button" className="btn ghost btn-sm" data-testid="read-aloud-pause" onClick={speech.pause}>
            Pause
          </button>
        )}
        <button type="button" className="btn ghost btn-sm" data-testid="read-aloud-stop" onClick={speech.stop} disabled={!isActive}>
          Stop
        </button>
        <button type="button" className="btn ghost btn-sm" data-testid="read-aloud-previous" onClick={speech.previous} disabled={!isActive}>
          Previous
        </button>
        <button type="button" className="btn ghost btn-sm" data-testid="read-aloud-next" onClick={speech.next} disabled={!isActive}>
          Next
        </button>
      </div>
      <label className="read-aloud-setting">
        <span>Voice</span>
        <select
          data-testid="read-aloud-voice"
          aria-label="Read aloud voice"
          value={speech.voiceName}
          onChange={(event) => speech.setVoiceName(event.target.value)}
        >
          {speech.voices.length === 0 && <option value="">System voice</option>}
          {speech.voices.map((voice) => (
            <option key={`${voice.name}-${voice.voiceURI || voice.lang}`} value={voice.name}>
              {voice.name}{voice.lang ? ` (${voice.lang})` : ''}
            </option>
          ))}
        </select>
      </label>
      <label className="read-aloud-setting">
        <span>Speed</span>
        <select
          data-testid="read-aloud-speed"
          aria-label="Read aloud speed"
          value={String(speech.rate)}
          onChange={(event) => speech.setRate(Number(event.target.value))}
        >
          {SPEED_OPTIONS.map((value) => (
            <option key={value} value={String(value)}>{value}×</option>
          ))}
        </select>
      </label>
      <span className="read-aloud-status" data-testid="read-aloud-status" aria-live="polite">
        {activeUnit ? `Reading ${speech.activeIndex + 1}/${speech.units.length}: ${activeUnit.text}` : isActive ? 'Reading…' : 'Reads the selection, or the current chapter.'}
      </span>
    </div>
  );
}
