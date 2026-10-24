const SEASONAL_GLYPHS = {
  halloween: '🎃',
  christmas: '🎄',
  cny: '🏮',
}

export const SeasonalEffects = ({ seasonalTheme }) => {
  const glyph = SEASONAL_GLYPHS[seasonalTheme]
  if (!glyph) return null

  return (
    <div className="seasonal-theme-glyph" aria-hidden="true" data-testid="seasonal-theme-glyph">
      {glyph}
    </div>
  )
}

export default SeasonalEffects
