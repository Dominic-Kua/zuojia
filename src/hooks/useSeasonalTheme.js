import { useEffect, useState } from 'react'
import {
  SEASONAL_THEME_STORAGE_KEY,
  normalizeSeasonalPreference,
  getStoredSeasonalPreference,
  resolveActiveSeasonalTheme,
} from '../lib/seasonal-theme.js'

export const useSeasonalTheme = (interval = 60000, preferenceOverride) => {
  const getActiveTheme = () => {
    const preference = preferenceOverride ?? getStoredSeasonalPreference()
    const normalized = normalizeSeasonalPreference(preference)
    return resolveActiveSeasonalTheme(normalized) ?? 'off'
  }

  const [seasonalTheme, setSeasonalTheme] = useState(getActiveTheme)

  useEffect(() => {
    const refreshTheme = () => setSeasonalTheme(getActiveTheme())
    refreshTheme()

    const handleStorageChange = (event) => {
      if (event.key === SEASONAL_THEME_STORAGE_KEY) refreshTheme()
    }
    window.addEventListener('storage', handleStorageChange)

    const timer = interval >= 60000 ? setInterval(refreshTheme, interval) : null

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      if (timer) clearInterval(timer)
    }
  }, [interval, preferenceOverride])

  return seasonalTheme
}
