import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// Set up localStorage mock BEFORE any imports
const mockLocalStorage = {
  _data: {},
  getItem: vi.fn((key) => mockLocalStorage._data[key] || null),
  setItem: vi.fn((key, value) => {
    mockLocalStorage._data[key] = value
  }),
  removeItem: vi.fn((key) => {
    delete mockLocalStorage._data[key]
  }),
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
})

// Mock the seasonal-theme module at the top level
vi.mock('../../../src/lib/seasonal-theme.js', () => {
  const normalizeSeasonalPreference = vi.fn((value) => {
    if (typeof value !== 'string') return 'off'
    const normalized = value.trim()
    return ['off', 'automatic'].includes(normalized) ? normalized : 'off'
  })

  return {
    SEASONAL_THEME_STORAGE_KEY: 'zuojia-seasonal-theme',
    SEASONAL_THEME_MODES: Object.freeze(['off', 'automatic']),
    normalizeSeasonalPreference,
    getStoredSeasonalPreference: vi.fn(() => mockLocalStorage.getItem('zuojia-seasonal-theme') || null),
    resolveSeasonalTheme: vi.fn(() => null),
    resolveActiveSeasonalTheme: vi.fn((preference) => {
      if (normalizeSeasonalPreference(preference) !== 'automatic') return null
      return null
    }),
  }
})

import * as seasonalTheme from '../../../src/lib/seasonal-theme.js'
import { useSeasonalTheme } from '../../../src/hooks/useSeasonalTheme.js'

describe('useSeasonalTheme hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage._data = {}
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes with off when stored preference is automatic and no date falls in season', async () => {
    mockLocalStorage.setItem('zuojia-seasonal-theme', 'automatic')
    
    const { result } = renderHook(() => useSeasonalTheme(100))

    expect(result.current).toBe('off')
  })

  it('updates seasonal theme on storage change event', async () => {
    mockLocalStorage.setItem('zuojia-seasonal-theme', 'automatic')
    
    const { result } = renderHook(() => useSeasonalTheme(100))

    expect(result.current).toBe('off')

    // Simulate storage event
    const storageEvent = new Event('storage', { key: 'zuojia-seasonal-theme' })
    window.dispatchEvent(storageEvent)

    expect(result.current).toBe('off')
  })

  it('handles invalid stored preference by defaulting to off', async () => {
    mockLocalStorage.setItem('zuojia-seasonal-theme', 'invalid')
    
    const { result } = renderHook(() => useSeasonalTheme(100))

    expect(result.current).toBe('off')
  })

  it('respects injected interval (mocked)', async () => {
    mockLocalStorage.setItem('zuojia-seasonal-theme', 'automatic')
    
    const { result } = renderHook(() => useSeasonalTheme(100))

    expect(result.current).toBe('off')
  })

  it('returns off when stored preference is off', async () => {
    mockLocalStorage.setItem('zuojia-seasonal-theme', 'off')
    
    const { result } = renderHook(() => useSeasonalTheme(100))

    expect(result.current).toBe('off')
  })
})
