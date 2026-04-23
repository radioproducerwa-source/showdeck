export const THEMES = {
  light: {
    key: 'light',
    name: 'Light',
    description: 'Clean white — current look',
    preview: ['#ffffff', '#00e5a0'],
    vars: {
      '--t-bg': '#f7f8fa',
      '--t-surface': '#ffffff',
      '--t-border': '#e2e4e8',
      '--t-accent': '#00e5a0',
      '--t-accent-hover': '#00ffc0',
      '--t-accent-dark': '#00a870',
      '--t-text': '#0d0d0f',
      '--t-muted': '#6b6b7a',
      '--t-dim': '#c8cad0',
      '--t-nav-bg': '#ffffff',
    },
  },
  dark: {
    key: 'dark',
    name: 'Dark',
    description: 'Dark mode with green accent',
    preview: ['#0d0d0f', '#00e5a0'],
    vars: {
      '--t-bg': '#0d0d0f',
      '--t-surface': '#1a1a1a',
      '--t-border': '#2a2a2a',
      '--t-accent': '#00e5a0',
      '--t-accent-hover': '#00ffc0',
      '--t-accent-dark': '#00a870',
      '--t-text': '#f0f0f0',
      '--t-muted': '#888899',
      '--t-dim': '#555566',
      '--t-nav-bg': '#111113',
    },
  },
  midnight: {
    key: 'midnight',
    name: 'Midnight Blue',
    description: 'Deep navy with sky blue accent',
    preview: ['#0a0f1e', '#4fc3f7'],
    vars: {
      '--t-bg': '#0a0f1e',
      '--t-surface': '#111827',
      '--t-border': '#1e2a40',
      '--t-accent': '#4fc3f7',
      '--t-accent-hover': '#81d4fa',
      '--t-accent-dark': '#29b6f6',
      '--t-text': '#e2e8f0',
      '--t-muted': '#7a8aaa',
      '--t-dim': '#3a4a66',
      '--t-nav-bg': '#080d18',
    },
  },
  charcoal: {
    key: 'charcoal',
    name: 'Charcoal',
    description: 'Dark grey with coral accent',
    preview: ['#1a1a1a', '#ff6b6b'],
    vars: {
      '--t-bg': '#1a1a1a',
      '--t-surface': '#242424',
      '--t-border': '#333333',
      '--t-accent': '#ff6b6b',
      '--t-accent-hover': '#ff8c8c',
      '--t-accent-dark': '#e05555',
      '--t-text': '#f0f0f0',
      '--t-muted': '#8a8a8a',
      '--t-dim': '#555555',
      '--t-nav-bg': '#111111',
    },
  },
} as const

export type ThemeKey = keyof typeof THEMES

export const DEFAULT_THEME: ThemeKey = 'light'

export function applyTheme(key: ThemeKey) {
  const t = THEMES[key] || THEMES[DEFAULT_THEME]
  const root = document.documentElement
  Object.entries(t.vars).forEach(([k, v]) => root.style.setProperty(k, v))
  root.setAttribute('data-theme', key)
}

export function getStoredTheme(): ThemeKey {
  if (typeof window === 'undefined') return DEFAULT_THEME
  const stored = localStorage.getItem('showdeck_theme')
  return (stored && stored in THEMES) ? stored as ThemeKey : DEFAULT_THEME
}

export function storeTheme(key: ThemeKey) {
  localStorage.setItem('showdeck_theme', key)
}
