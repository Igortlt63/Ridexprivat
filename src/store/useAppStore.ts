import { create } from 'zustand'
import type { Profile, UserRole } from '@/types'
import { createClient } from '@/lib/supabase/client'

export type Theme = 'light' | 'dark' | 'system'

interface AppState {
  // ── Профиль ───────────────────────────────────────────────────
  profile:    Profile | null
  userId:     string
  loading:    boolean

  // ── Роль: passenger | driver (сохраняется в localStorage) ─────
  activeRole: UserRole
  setActiveRole: (role: UserRole) => void

  // ── Тема: light | dark | system (сохраняется в localStorage) ──
  theme:    Theme
  setTheme: (theme: Theme) => void

  // ── Методы профиля ────────────────────────────────────────────
  loadProfile:    () => Promise<void>
  refreshProfile: () => Promise<void>
  reset:          () => void
}

/** Читаем из localStorage безопасно (SSR-safe) */
function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const v = localStorage.getItem(key)
    return v !== null ? (v as unknown as T) : fallback
  } catch {
    return fallback
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  profile:    null,
  userId:     '',
  loading:    false,
  activeRole: readStorage<UserRole>('activeRole', 'passenger'),
  theme:      readStorage<Theme>('theme', 'system'),

  setActiveRole: (role) => {
    if (typeof window !== 'undefined') localStorage.setItem('activeRole', role)
    set({ activeRole: role })
  },

  setTheme: (theme) => {
    if (typeof window !== 'undefined') localStorage.setItem('theme', theme)
    set({ theme })
    // Применяем класс немедленно
    applyTheme(theme)
  },

  loadProfile: async () => {
    if (get().userId) return
    await get().refreshProfile()
  },

  refreshProfile: async () => {
    set({ loading: true })
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { set({ loading: false }); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    set({ profile: profile ?? null, userId: user.id, loading: false })
  },

  reset: () => set({ profile: null, userId: '', loading: false }),
}))

/** Применяет тему к <html> — вызывается и из стора, и из ThemeProvider */
export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else if (theme === 'light') {
    root.classList.remove('dark')
  } else {
    // system
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    prefersDark ? root.classList.add('dark') : root.classList.remove('dark')
  }
}
