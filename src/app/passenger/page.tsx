'use client'

// src/app/passenger/page.tsx
// Кабинет пассажира — главный экран

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Clock, MapPin, Star, ChevronRight, Package, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Ride, Profile } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'

const STATUS_LABELS: Record<string, string> = {
  searching:   'Ищу водителя',
  negotiating: 'Идёт торг',
  accepted:    'Водитель найден',
  in_progress: 'В пути',
  completed:   'Завершена',
  cancelled:   'Отменена',
}

export default function PassengerPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile]       = useState<Profile | null>(null)
  const [activeRides, setActiveRides] = useState<Ride[]>([])
  const [loading, setLoading]        = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      // Загружаем профиль
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfile(prof)

      // Загружаем активные заявки пассажира
      const { data: rides } = await supabase
        .from('rides')
        .select('*')
        .eq('passenger_id', user.id)
        .in('status', ['searching', 'negotiating', 'accepted', 'in_progress'])
        .order('created_at', { ascending: false })
      setActiveRides(rides || [])
      setLoading(false)

      // Realtime-подписка на изменения заявок
      const channel = supabase
        .channel('passenger-rides')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'rides',
          filter: `passenger_id=eq.${user.id}`,
        }, (payload) => {
          if (payload.eventType === 'UPDATE') {
            setActiveRides(prev =>
              prev.map(r => r.id === payload.new.id ? { ...r, ...payload.new } as Ride : r)
            )
          }
        })
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Шапка */}
      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Пассажир</h1>
            {profile && (
              <div className="flex items-center gap-1 mt-0.5">
                <Star className="w-3.5 h-3.5 text-warning-500" fill="currentColor" />
                <span className="text-xs text-gray-500">
                  {Number(profile.rating_passenger).toFixed(1)} · {profile.total_rides_as_passenger} поездок
                </span>
              </div>
            )}
          </div>
          <Link href="/" className="btn-ghost text-xs px-3 py-2 rounded-xl">
            ← Назад
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Кнопка создания заявки */}
        <Link
          href="/passenger/new-ride"
          className="flex items-center gap-4 bg-primary-600 hover:bg-primary-700 active:scale-95 text-white rounded-2xl p-5 transition-all duration-150 shadow-lg shadow-primary-200"
        >
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Plus className="w-6 h-6" />
          </div>
          <div>
            <p className="font-semibold text-lg">Создать заявку</p>
            <p className="text-primary-200 text-sm">Укажи маршрут и цену</p>
          </div>
          <ChevronRight className="w-5 h-5 ml-auto text-primary-300" />
        </Link>

        {/* Активные заявки */}
        {activeRides.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Активные заявки
            </h2>
            <div className="space-y-3">
              {activeRides.map(ride => (
                <Link
                  key={ride.id}
                  href={`/passenger/ride/${ride.id}`}
                  className="card p-4 block hover:shadow-card-hover transition-all active:scale-95"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`status-${ride.status}`}>
                          {STATUS_LABELS[ride.status]}
                        </span>
                        {ride.status === 'negotiating' && (
                          <span className="badge-warning animate-pulse">Новое предложение!</span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <div className="w-2 h-2 bg-success-500 rounded-full flex-shrink-0" />
                          <span className="truncate">{ride.origin_address}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <div className="w-2 h-2 bg-danger-500 rounded-full flex-shrink-0" />
                          <span className="truncate">{ride.dest_address}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-gray-900">
                        {ride.passenger_price.toLocaleString('ru-RU')} ₽
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(ride.created_at), {
                          addSuffix: true, locale: ru
                        })}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Быстрые действия */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Быстрые действия
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/passenger/history"
              className="card p-4 flex items-center gap-3 hover:shadow-card-hover transition-all active:scale-95"
            >
              <Clock className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">История</span>
            </Link>
            <Link
              href="/passenger/routes"
              className="card p-4 flex items-center gap-3 hover:shadow-card-hover transition-all active:scale-95"
            >
              <MapPin className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Маршруты</span>
            </Link>
            <Link
              href="/market"
              className="card p-4 flex items-center gap-3 hover:shadow-card-hover transition-all active:scale-95"
            >
              <Package className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Маркет</span>
            </Link>
            <Link
              href="/passenger/support"
              className="card p-4 flex items-center gap-3 hover:shadow-card-hover transition-all active:scale-95"
            >
              <AlertCircle className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Поддержка</span>
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
