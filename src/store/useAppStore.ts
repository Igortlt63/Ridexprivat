import { create } from 'zustand'
import type { Profile } from '@/types'
import { createClient } from '@/lib/supabase/client'

interface AppState {
  profile:    Profile | null
  userId:     string
  loading:    boolean
  // Загрузить профиль (кешируется — повторные вызовы не делают запрос)
  loadProfile: () => Promise<void>
  // Принудительно обновить (например, после редактирования)
  refreshProfile: () => Promise<void>
  reset:       () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  profile:  null,
  userId:   '',
  loading:  false,

  loadProfile: async () => {
    // Уже загружен — пропускаем
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
