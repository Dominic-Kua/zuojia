import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock scrollIntoView for jsdom (used by LlmChatWindow)
if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView = vi.fn();
}
