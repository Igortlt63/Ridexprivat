'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Star, Clock, CheckCircle, XCircle, Car } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Ride, Profile } from '@/types'
import type { LucideIcon } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

// Тип для поездки с частичными данными водителя (из join-запроса)
type RideWithDriver = Ride & {
  driver?: Pick<Profile, 'full_name' | 'rating_driver'> | null
}

type FilterKey = 'all' | 'completed' | 'cancelled'

const STATUS_LABELS: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  completed:   { label: 'Завершена',     icon: CheckCircle, color: 'text-green-600' },
  cancelled:   { label: 'Отменена',      icon: XCircle,     color: 'text-rose-500' },
  in_progress: { label: 'В пути',        icon: Car,         color: 'text-indigo-600' },
  accepted:    { label: 'Водитель едет', icon: Car,         color: 'text-indigo-600' },
  searching:   { label: 'Ищем водителя', icon: Clock,       color: 'text-amber-600' },
  negotiating: { label: 'Торг',          icon: Clock,       color: 'text-amber-600' },
}

const PAGE_SIZE = 20

export default function HistoryPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [rides,    setRides]    = useState<RideWithDriver[]>([])
  const [loading,  setLoading]  = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore,  setHasMore]  = useState(false)
  const [page,     setPage]     = useState(0)
  const [filter,   setFilter]   = useState<FilterKey>('all')

  const fetchRides = useCallback(async (pageIndex: number, currentFilter: FilterKey) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    let query = supabase
      .from('rides')
      .select('*, driver:profiles!rides_driver_id_fkey(full_name, rating_driver)')
      .eq('passenger_id', user.id)
      .order('created_at', { ascending: false })
      .range(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE - 1)

    if (currentFilter !== 'all') {
      query = query.eq('status', currentFilter)
    }

    const { data } = await query
    return (data as RideWithDriver[]) || []
  }, [supabase, router])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const data = await fetchRides(0, filter)
      if (data) {
        setRides(data)
        setHasMore(data.length === PAGE_SIZE)
      }
      setPage(0)
      setLoading(false)
    }
    load()
  }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadMore() {
    setLoadingMore(true)
    const nextPage = page + 1
    const data = await fetchRides(nextPage, filter)
    if (data) {
      setRides(prev => [...prev, ...data])
      setHasMore(data.length === PAGE_SIZE)
      setPage(nextPage)
    }
    setLoadingMore(false)
  }

  const filtered = rides // фильтрация теперь на сервере

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="btn-ghost p-2 rounded-xl">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">История поездок</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Фильтры */}
        <div className="flex gap-2 mb-4">
          {([
            { key: 'all'       as FilterKey, label: 'Все' },
            { key: 'completed' as FilterKey, label: 'Завершённые' },
            { key: 'cancelled' as FilterKey, label: 'Отменённые' },
          ]).map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
                filter === f.key ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700'
              }`}
            >{f.label}</button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-10 text-center">
            <Car className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Поездок нет</p>
            <Link href="/passenger/new-ride" className="btn-primary btn-sm mt-4 inline-flex">
              Создать заявку
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(ride => {
              const st = STATUS_LABELS[ride.status] || STATUS_LABELS.searching
              const Icon = st.icon
              return (
                <Link key={ride.id} href={`/passenger/ride/${ride.id}`}
                  className="card block p-4 hover:shadow-md transition-all active:scale-95"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <Icon className={`w-4 h-4 ${st.color}`} />
                      <span className={`text-xs font-semibold ${st.color}`}>{st.label}</span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {format(new Date(ride.created_at), 'd MMM yyyy', { locale: ru })}
                    </span>
                  </div>

                  <div className="space-y-1.5 mb-3">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                      <span className="truncate">{ride.origin_address}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <div className="w-2 h-2 bg-rose-500 rounded-full flex-shrink-0" />
                      <span className="truncate">{ride.dest_address}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-50 dark:border-slate-800">
                    <span className="font-bold text-gray-900 dark:text-white">
                      {(ride.final_price || ride.passenger_price).toLocaleString('ru-RU')} ₽
                    </span>
                    {ride.driver && (
                      <div className="flex items-center gap-1.5">
                        <Car className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs text-gray-500">{ride.driver.full_name}</span>
                        <div className="flex items-center gap-0.5">
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                          <span className="text-xs text-gray-500">
                            {Number(ride.driver.rating_driver).toFixed(1)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}

            {/* Пагинация — кнопка «Загрузить ещё» */}
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-3 rounded-xl text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
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
