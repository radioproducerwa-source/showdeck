// Shared date helpers. All episode/plan dates are date-only ISO strings
// (YYYY-MM-DD) interpreted in the user's local timezone.

/** Parse a date-only ISO string as local midnight (avoids UTC off-by-one). */
export const parseDateOnly = (iso: string) => new Date(iso + 'T00:00:00')

/** Today as a date-only ISO string in the user's local timezone. */
export const todayISO = () => new Date().toLocaleDateString('en-CA')

export const formatEpisodeDate = (iso: string | null | undefined, style: 'short' | 'long' = 'short') => {
  if (!iso) return ''
  return parseDateOnly(iso).toLocaleDateString('en-AU',
    style === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      : { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }
  )
}
