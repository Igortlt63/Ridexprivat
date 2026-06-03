'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Star, CheckCircle, XCircle, Car, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Ride, Profile } from '@/types'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

// Тип для поездки с частичными данными пассажира (из join-запроса)
type RideWithPassenger = Ride & {
  passenger?: Pick<Profile, 'full_name' | 'rating_passenger'> | null
}

const PAGE_SIZE = 20

export default function DriverHistoryPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [rides,       setRides]       = useState<RideWithPassenger[]>([])
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore,     setHasMore]     = useState(false)
  const [page,        setPage]        = useState(0)
  const [stats,       setStats]       = useState({ total: 0, completed: 0, earned: 0 })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      // Статистика грузится отдельным лёгким запросом (без лимита)
      const { data: statsData } = await supabase
        .from('rides')
        .select('status, final_price, passenger_price')
        .eq('driver_id', user.id)

      if (statsData) {
        const completed = statsData.filter(r => r.status === 'completed')
        const earned    = completed.reduce((s, r) => s + (r.final_price || r.passenger_price || 0), 0)
        setStats({ total: statsData.length, completed: completed.length, earned })
      }

      // Первая страница поездок
      const { data } = await supabase
        .from('rides')
        .select('*, passenger:profiles!rides_passenger_id_fkey(full_name, rating_passenger)')
        .eq('driver_id', user.id)
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE - 1)

      const ridesPage = (data as RideWithPassenger[]) || []
      setRides(ridesPage)
      setHasMore(ridesPage.length === PAGE_SIZE)
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadMore() {
    setLoadingMore(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoadingMore(false); return }

    const nextPage = page + 1
    const { data } = await supabase
      .from('rides')
      .select('*, passenger:profiles!rides_passenger_id_fkey(full_name, rating_passenger)')
      .eq('driver_id', user.id)
      .order('created_at', { ascending: false })
      .range(nextPage * PAGE_SIZE, (nextPage + 1) * PAGE_SIZE - 1)

    const ridesPage = (data as RideWithPassenger[]) || []
    setRides(prev => [...prev, ...ridesPage])
    setHasMore(ridesPage.length === PAGE_SIZE)
    setPage(nextPage)
    setLoadingMore(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="btn-ghost p-2 rounded-xl">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">История рейсов</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Статистика */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Всего рейсов', value: stats.total, icon: Car },
            { label: 'Завершено',    value: stats.completed, icon: CheckCircle },
            { label: 'Заработано',   value: `${stats.earned.toLocaleString('ru-RU')} ₽`, icon: TrendingUp },
          ].map(s => (
            <div key={s.label} className="card p-3 text-center">
              <s.icon className="w-5 h-5 text-indigo-400 mx-auto mb-1" />
              <p className="font-bold text-gray-900 text-sm">{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : rides.length === 0 ? (
          <div className="card p-10 text-center">
            <Car className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500">Рейсов ещё не было</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rides.map(ride => (
              <div key={ride.id} className="card p-4" >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    {ride.status === 'completed'
                      ? <CheckCircle className="w-4 h-4 text-green-600" />
                      : <XCircle className="w-4 h-4 text-rose-500" />
                    }
                    <span className={`text-xs font-semibold ${ride.status === 'completed' ? 'text-green-600' : 'text-rose-500'}`}>
                      {ride.status === 'completed' ? 'Завершён' : 'Отменён'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {format(new Date(ride.created_at), 'd MMM yyyy', { locale: ru })}
                  </span>
                </div>

                <div className="space-y-1 mb-2">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                    <span className="truncate">{ride.origin_address}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="w-2 h-2 bg-rose-500 rounded-full flex-shrink-0" />
                    <span className="truncate">{ride.dest_address}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                  <span className="font-bold text-gray-900">
                    {(ride.final_price || ride.passenger_price).toLocaleString('ru-RU')} ₽
                  </span>
                  {ride.passenger && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">{ride.passenger.full_name}</span>
                      <div className="flex items-center gap-0.5">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span className="text-xs text-gray-500">
                          {Number(ride.passenger.rating_passenger).toFixed(1)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Пагинация — кнопка «Загрузить ещё» */}
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-3 rounded-xl text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Загрузка...' : 'Загрузить ещё'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
