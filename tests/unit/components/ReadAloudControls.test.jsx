import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, act } from '@testing-library/react';
import ReadAloudControls from '../../../src/components/ReadAloudControls.jsx';

class MockUtterance {
  constructor(text) {
    this.text = text;
    this.rate = 1;
    this.voice = null;
    this.onstart = null;
    this.onend = null;
    this.onerror = null;
  }
}

describe('ReadAloudControls', () => {
  let utterances;
  let synth;

  beforeEach(() => {
    utterances = [];
    synth = {
      speaking: false,
      paused: false,
      getVoices: () => [
        { name: 'Alex', lang: 'en-US', default: true, localService: true, voiceURI: 'alex' },
        { name: 'Samantha', lang: 'en-US', default: false, localService: true, voiceURI: 'sam' },
      ],
      speak: vi.fn((utterance) => {
        utterances.push(utterance);
        synth.speaking = true;
        synth.paused = false;
      }),
      cancel: vi.fn(() => {
        synth.speaking = false;
        synth.paused = false;
      }),
      pause: vi.fn(() => { synth.paused = true; }),
      resume: vi.fn(() => { synth.paused = false; }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    window.speechSynthesis = synth;
    window.SpeechSynthesisUtterance = MockUtterance;
    window.localStorage.removeItem('zuojia-tts-voice');
    window.localStorage.removeItem('zuojia-tts-rate');
  });

  afterEach(() => {
    delete window.speechSynthesis;
    delete window.SpeechSynthesisUtterance;
  });

  it('plays the current text, pauses/resumes, and stops', async () => {
    render(<ReadAloudControls getText={() => 'Hello there. Goodbye now.'} />);

    fireEvent.click(screen.getByTestId('read-aloud-play'));
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(utterances[0].text).toBe('Hello there.');

    await act(async () => { utterances[0].onstart?.(); });
    expect(screen.getByTestId('read-aloud-status')).toHaveTextContent('Reading 1/2');

    fireEvent.click(screen.getByTestId('read-aloud-pause'));
    expect(synth.pause).toHaveBeenCalled();
    expect(screen.getByTestId('read-aloud-play')).toHaveTextContent('Resume');

    fireEvent.click(screen.getByTestId('read-aloud-play'));
    expect(synth.resume).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('read-aloud-stop'));
    expect(synth.cancel).toHaveBeenCalled();
    expect(screen.getByTestId('read-aloud-status')).toHaveTextContent('Reads the selection');
  });

  it('navigates between units and reports the active unit', async () => {
    const onActiveUnitChange = vi.fn();
    render(
      <ReadAloudControls
        getText={() => 'One. Two. Three.'}
        onActiveUnitChange={onActiveUnitChange}
      />,
    );

    fireEvent.click(screen.getByTestId('read-aloud-play'));
    await act(async () => { utterances[0].onstart?.(); });
    expect(onActiveUnitChange).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('read-aloud-next'));
    expect(synth.cancel).toHaveBeenCalled();
    expect(synth.speak).toHaveBeenCalledTimes(2);
    expect(utterances[1].text).toBe('Two.');
  });

  it('applies selected voice and speed', async () => {
    render(<ReadAloudControls getText={() => 'Hello world.'} />);

    fireEvent.change(screen.getByTestId('read-aloud-speed'), { target: { value: '1.5' } });
    fireEvent.change(screen.getByTestId('read-aloud-voice'), { target: { value: 'Samantha' } });
    fireEvent.click(screen.getByTestId('read-aloud-play'));

    expect(utterances[0].rate).toBe(1.5);
    expect(utterances[0].voice?.name).toBe('Samantha');
  });

  it('shows an unsupported message when speech synthesis is unavailable', () => {
    delete window.speechSynthesis;
    delete window.SpeechSynthesisUtterance;
    render(<ReadAloudControls getText={() => 'Hello.'} />);
    expect(screen.getByTestId('read-aloud-unsupported')).toHaveTextContent('not available');
  });
});
