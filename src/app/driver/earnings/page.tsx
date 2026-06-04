'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, TrendingUp, Calendar, Star, Car } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { startOfDay, startOfWeek, startOfMonth, isAfter } from 'date-fns'
import { ru } from 'date-fns/locale'

export default function EarningsPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [period,  setPeriod]  = useState<'day' | 'week' | 'month' | 'all'>('week')
  const [stats, setStats]     = useState({
    earned: 0, rides: 0, avgPrice: 0, rating: 5,
    byDay: [] as { date: string; amount: number; count: number }[]
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      const { data: rides } = await supabase
        .from('rides')
        .select('final_price, passenger_price, created_at, status')
        .eq('driver_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })

      const { data: prof } = await supabase
        .from('profiles').select('rating_driver').eq('id', user.id).single()

      const now = new Date()
      const from =
        period === 'day'   ? startOfDay(now) :
        period === 'week'  ? startOfWeek(now, { locale: ru }) :
        period === 'month' ? startOfMonth(now) : new Date(0)

      const filtered = (rides || []).filter(r => isAfter(new Date(r.created_at), from))
      const earned   = filtered.reduce((s, r) => s + (r.final_price || r.passenger_price || 0), 0)

      // Группируем по дням для мини-графика
      const byDayMap: Record<string, { amount: number; count: number }> = {}
      filtered.forEach(r => {
        const day = r.created_at.slice(0, 10)
        if (!byDayMap[day]) byDayMap[day] = { amount: 0, count: 0 }
        byDayMap[day].amount += r.final_price || r.passenger_price || 0
        byDayMap[day].count  += 1
      })
      const byDay = Object.entries(byDayMap)
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-7)

      setStats({
        earned,
        rides:    filtered.length,
        avgPrice: filtered.length ? earned / filtered.length : 0,
        rating:   prof?.rating_driver || 5,
        byDay,
      })
      setLoading(false)
    }
    load()
  }, [period])

  const maxAmount = Math.max(...stats.byDay.map(d => d.amount), 1)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="btn-ghost p-2 rounded-xl">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Мой заработок</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {/* Переключатель периода */}
        <div className="flex gap-1.5 bg-white rounded-2xl p-1.5 border border-gray-100">
          {([
            { key: 'day',   label: 'Сегодня' },
            { key: 'week',  label: 'Неделя' },
            { key: 'month', label: 'Месяц' },
            { key: 'all',   label: 'Всё время' },
          ] as const).map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                period === p.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >{p.label}</button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Главная цифра */}
            <div className="card p-6 text-center bg-gradient-to-br from-indigo-600 to-indigo-700 border-0">
              <p className="text-indigo-200 text-sm mb-1">Заработано</p>
              <p className="text-4xl font-bold text-white">{stats.earned.toLocaleString('ru-RU')} ₽</p>
            </div>

            {/* Статистика */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Car,       label: 'Рейсов',      value: stats.rides },
                { icon: TrendingUp, label: 'Средний чек', value: `${Math.round(stats.avgPrice)} ₽` },
                { icon: Star,      label: 'Рейтинг',     value: Number(stats.rating).toFixed(1) },
              ].map(s => (
                <div key={s.label} className="card p-3 text-center">
                  <s.icon className="w-5 h-5 text-indigo-400 mx-auto mb-1" />
                  <p className="font-bold text-gray-900 text-sm">{s.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Мини-график */}
            {stats.byDay.length > 0 && (
              <div className="card p-4">
                <p className="font-semibold text-gray-900 mb-4 text-sm">По дням</p>
                <div className="flex items-end gap-1.5 h-24">
                  {stats.byDay.map(d => (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-indigo-500 rounded-t-md transition-all"
                        style={{ height: `${Math.round((d.amount / maxAmount) * 80)}px`, minHeight: '4px' }}
                        title={`${d.amount.toLocaleString('ru-RU')} ₽`}
                      />
                      <p className="text-xs text-gray-400 truncate w-full text-center">
                        {d.date.slice(5)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
