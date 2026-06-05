'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Индикатор подключения Realtime
// Показывает зелёную точку когда обновления активны
export default function LiveIndicator() {
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>('connecting')

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel('live-ping')
      .subscribe(s => {
        if (s === 'SUBSCRIBED') setStatus('live')
        else if (s === 'CHANNEL_ERROR' || s === 'CLOSED' || s === 'TIMED_OUT') setStatus('offline')
      })

    return () => { supabase.removeChannel(channel) }
  }, [])

  if (status === 'live') return (
    <span className="inline-flex items-center gap-1 text-xs text-green-600">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
      </span>
      Live
    </span>
  )

  if (status === 'offline') return (
    <span className="inline-flex items-center gap-1 text-xs text-rose-500">
      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
      Офлайн
    </span>
  )

  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-pulse" />
      Подключаемся...
    </span>
  )
}