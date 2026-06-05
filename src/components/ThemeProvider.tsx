'use client'

import { useEffect } from 'react'
import { useAppStore, applyTheme } from '@/store/useAppStore'

export default function ThemeProvider() {
  const theme = useAppStore(s => s.theme)

  useEffect(() => {
    // Применяем тему при монтировании
    applyTheme(theme)

    // Следим за системной темой в режиме 'system'
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  return null // только side-effect, ничего не рендерит
}
