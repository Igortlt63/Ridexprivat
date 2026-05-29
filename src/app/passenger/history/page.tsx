'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, MapPin, Star, Clock, CheckCircle, XCircle, Car } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Ride } from '@/types'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

const STATUS_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  completed:   { label: 'Завершена',     icon: CheckCircle, color: 'text-green-600' },
  cancelled:   { label: 'Отменена',      icon: XCircle,     color: 'text-rose-500' },
  in_progress: { label: 'В пути',        icon: Car,         color: 'text-indigo-600' },
  accepted:    { label: 'Водитель едет', icon: Car,         color: 'text-indigo-600' },
  searching:   { label: 'Ищем водителя', icon: Clock,       color: 'text-amber-600' },
  negotiating: { label: 'Торг',          icon: Clock,       color: 'text-amber-600' },
}

export default function HistoryPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [rides,   setRides]   = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState<'all' | 'completed' | 'cancelled'>('all')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      const { data } = await supabase
        .from('rides')
        .select('*, driver:profiles!rides_driver_id_fkey(full_name, rating_driver)')
        .eq('passenger_id', user.id)
        .order('created_at', { ascending: false })
      setRides(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = rides.filter(r => {
    if (filter === 'all') return true
    return r.status === filter
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="btn-ghost p-2 rounded-xl">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">История поездок</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Фильтры */}
        <div className="flex gap-2 mb-4">
          {[
            { key: 'all',       label: 'Все' },
            { key: 'completed', label: 'Завершённые' },
            { key: 'cancelled', label: 'Отменённые' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key as any)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
                filter === f.key ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
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

                  <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                    <span className="font-bold text-gray-900">
                      {(ride.final_price || ride.passenger_price).toLocaleString('ru-RU')} ₽
                    </span>
                    {(ride as any).driver && (
                      <div className="flex items-center gap-1.5">
                        <Car className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs text-gray-500">{(ride as any).driver.full_name}</span>
                        <div className="flex items-center gap-0.5">
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                          <span className="text-xs text-gray-500">
                            {Number((ride as any).driver.rating_driver).toFixed(1)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
