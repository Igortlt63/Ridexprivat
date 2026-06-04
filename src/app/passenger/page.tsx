'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Clock, MapPin, Star, ChevronRight, Package, AlertCircle, ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import LiveIndicator from '@/components/ui/LiveIndicator'
import type { Ride, Profile } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  searching:   { label: 'Ищу водителя',    cls: 'status-searching' },
  negotiating: { label: 'Идёт торг',       cls: 'status-negotiating' },
  accepted:    { label: 'Водитель найден', cls: 'status-accepted' },
  in_progress: { label: 'В пути',          cls: 'status-in_progress' },
  completed:   { label: 'Завершена',       cls: 'status-completed' },
  cancelled:   { label: 'Отменена',        cls: 'status-cancelled' },
}

export default function PassengerPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [profile,     setProfile]     = useState<Profile | null>(null)
  const [activeRides, setActiveRides] = useState<Ride[]>([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      const { data: rides } = await supabase
        .from('rides').select('*').eq('passenger_id', user.id)
        .in('status', ['searching', 'negotiating', 'accepted', 'in_progress'])
        .order('created_at', { ascending: false })
      setActiveRides(rides || [])
      setLoading(false)

      // Realtime — отслеживаем все изменения поездок пассажира
      const channel = supabase.channel(`passenger-rides-${user.id}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'rides', filter: `passenger_id=eq.${user.id}`,
        }, (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Ride
            // Если поездка стала неактивной — убираем из списка активных
            if (!['searching', 'negotiating', 'accepted', 'in_progress'].includes(updated.status)) {
              setActiveRides(prev => prev.filter(r => r.id !== updated.id))
            } else {
              setActiveRides(prev => {
                const exists = prev.find(r => r.id === updated.id)
                if (exists) return prev.map(r => r.id === updated.id ? { ...r, ...updated } : r)
                return [updated, ...prev]
              })
            }
          } else if (payload.eventType === 'INSERT') {
            setActiveRides(prev => {
              if (prev.find(r => r.id === payload.new.id)) return prev
              return [payload.new as Ride, ...prev]
            })
          } else if (payload.eventType === 'DELETE') {
            setActiveRides(prev => prev.filter(r => r.id !== (payload.old as Ride).id))
          }
        })
        // Также слушаем новые офферы — чтобы пометить статус "новое предложение"
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'ride_offers',
        }, async ({ new: offer }) => {
          // Проверяем что оффер для нашей поездки
          const { data: ride } = await supabase
            .from('rides').select('passenger_id').eq('id', offer.ride_id).single()
          if (ride?.passenger_id === user.id) {
            setActiveRides(prev => prev.map(r =>
              r.id === offer.ride_id ? { ...r, status: 'negotiating' as const } : r
            ))
          }
        })
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }
    load()
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="btn-ghost p-2 rounded-xl">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Пассажир</h1>
              {profile && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <span className="text-xs text-gray-500">
                      {Number(profile.rating_passenger).toFixed(1)} · {profile.total_rides_as_passenger} поездок
                    </span>
                  </div>
                  <span className="text-gray-300">·</span>
                  <LiveIndicator />
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-5">
        {/* Создать заявку */}
        <Link href="/passenger/new-ride"
          className="flex items-center gap-4 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-2xl p-5 transition-all shadow-lg shadow-indigo-200"
        >
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Plus className="w-6 h-6" />
          </div>
          <div>
            <p className="font-semibold text-lg">Создать заявку</p>
            <p className="text-indigo-200 text-sm">Выбери маршрут на карте</p>
          </div>
          <ChevronRight className="w-5 h-5 ml-auto text-indigo-300" />
        </Link>

        {/* Активные заявки */}
        {activeRides.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Активные заявки
            </h2>
            <div className="space-y-3">
              {activeRides.map(ride => {
                const st = STATUS_LABELS[ride.status] || STATUS_LABELS.searching
                return (
                  <Link key={ride.id} href={`/passenger/ride/${ride.id}`}
                    className="card p-4 block hover:shadow-md transition-all active:scale-95"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={st.cls}>{st.label}</span>
                          {ride.status === 'negotiating' && (
                            <span className="badge-warning animate-pulse text-xs">Новое предложение!</span>
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                            <span className="truncate">{ride.origin_address}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <div className="w-2 h-2 bg-rose-500 rounded-full flex-shrink-0" />
                            <span className="truncate">{ride.dest_address}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-gray-900">
                          {ride.passenger_price.toLocaleString('ru-RU')} ₽
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDistanceToNow(new Date(ride.created_at), { addSuffix: true, locale: ru })}
                        </p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* Быстрые действия */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Разделы</h2>
          <div className="card divide-y divide-gray-50">
            {[
              { href: '/passenger/history', icon: Clock,         label: 'История поездок',       sub: 'Все ваши поездки' },
              { href: '/passenger/routes',  icon: MapPin,        label: 'Сохранённые маршруты',  sub: 'Быстрый доступ к маршрутам' },
              { href: '/market',            icon: Package,       label: 'Маркет',                sub: 'Авто, услуги, недвижимость' },
              { href: '/passenger/support', icon: AlertCircle,   label: 'Поддержка',             sub: 'Помощь и FAQ' },
            ].map(item => (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-4 h-4 text-gray-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.sub}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}