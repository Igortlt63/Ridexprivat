'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  Star, ToggleLeft, ToggleRight, Clock,
  Car, Map, List, ChevronLeft, Navigation
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import LiveIndicator from '@/components/ui/LiveIndicator'
import type { Ride, DriverVehicle } from '@/types'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useAppStore } from '@/store/useAppStore'
import OfferModal   from '@/components/driver/OfferModal'
import RideCard     from '@/components/driver/RideCard'
import MapWithRides from '@/components/driver/MapWithRides'

// ── Главный компонент ──────────────────────────────────────────
export default function DriverPage() {
  const router   = useRouter()
  const supabase = createClient()
  const apiKey   = process.env.NEXT_PUBLIC_YANDEX_MAPS_KEY || ''

  // Профиль и userId из Zustand (кешируется, не дублирует запросы)
  const { profile, userId: myId, loadProfile } = useAppStore()

  const [isOnline,     setIsOnline]     = useState(false)
  const [rides,        setRides]        = useState<Ride[]>([])
  const [activeRide,   setActiveRide]   = useState<Ride | null>(null)
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [vehicles,     setVehicles]     = useState<DriverVehicle[]>([])
  const [view,         setView]         = useState<'list' | 'map'>('list')
  const [myPos,        setMyPos]        = useState<{ lat: number; lng: number } | null>(null)
  const [geoError,     setGeoError]     = useState('')
  const intervalRef  = useRef<NodeJS.Timeout>()
  const channelRef   = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    async function load() {
      await loadProfile()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      const [{ data: vehs }, { data: statusData }, { data: ridesData }, { data: activeData }] =
        await Promise.all([
          supabase.from('driver_vehicles').select('*').eq('driver_id', user.id).eq('is_active', true),
          supabase.from('driver_status').select('is_online').eq('driver_id', user.id).single(),
          supabase.from('rides')
            .select('*, passenger:profiles!rides_passenger_id_fkey(*)')
            .eq('status', 'searching')
            .order('created_at', { ascending: false })
            .limit(20),
          supabase.from('rides')
            .select('*, passenger:profiles!rides_passenger_id_fkey(*)')
            .eq('driver_id', user.id)
            .in('status', ['accepted', 'in_progress'])
            .single(),
        ])

      setVehicles(vehs || [])
      setIsOnline(statusData?.is_online || false)
      setRides(ridesData || [])
      if (activeData) setActiveRide(activeData)
      setLoading(false)

      // Realtime — новые заявки
      // Сохраняем канал в ref, чтобы cleanup в useEffect мог его закрыть
      channelRef.current = supabase.channel('driver-rides')
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'rides',
        }, async ({ new: ride }) => {
          if (ride.status !== 'searching') return
          const { data } = await supabase
            .from('rides').select('*, passenger:profiles!rides_passenger_id_fkey(*)')
            .eq('id', ride.id).single()
          if (data) {
            setRides(prev => [data as Ride, ...prev])
            toast('📍 Новая заявка!', { icon: '🚗' })
          }
        })
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'rides',
        }, async ({ new: u }) => {
          // Убираем из списка поиска если статус изменился
          if (u.status !== 'searching') {
            setRides(prev => prev.filter(r => r.id !== u.id))
          }
          // Устанавливаем активную поездку водителя
          if (u.driver_id === user.id && ['accepted', 'in_progress'].includes(u.status)) {
            // Подгружаем полные данные с пассажиром
            const { data: full } = await supabase
              .from('rides')
              .select('*, passenger:profiles!rides_passenger_id_fkey(*)')
              .eq('id', u.id).single()
            if (full) {
              setActiveRide(full as Ride)
              if (u.status === 'accepted') {
                toast.success('✅ Пассажир принял ваше предложение!')
                // Автопереход на экран поездки
                router.push(`/driver/ride/${u.id}`)
              }
            }
          }
          // Сбрасываем если поездка завершена/отменена
          if (['completed', 'cancelled'].includes(u.status)) {
            setActiveRide(prev => prev?.id === u.id ? null : prev)
          }
        })
        .subscribe()
    }

    load()

    // Cleanup: закрываем канал и останавливаем геолокацию при размонтировании
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  async function toggleOnline() {
    if (!isOnline) {
      navigator.geolocation.getCurrentPosition(
        async pos => {
          const { latitude: lat, longitude: lng } = pos.coords
          setMyPos({ lat, lng })
          await supabase.rpc('update_driver_location', { p_driver_id: myId, p_lat: lat, p_lng: lng })
          setIsOnline(true)
          toast.success('Вы онлайн! Заказы будут приходить.')

          intervalRef.current = setInterval(async () => {
            navigator.geolocation.getCurrentPosition(async p2 => {
              setMyPos({ lat: p2.coords.latitude, lng: p2.coords.longitude })
              await supabase.rpc('update_driver_location', {
                p_driver_id: myId, p_lat: p2.coords.latitude, p_lng: p2.coords.longitude,
              })
            })
          }, 30000)
        },
        () => {
          setGeoError('Разрешите доступ к геолокации в настройках браузера')
          toast.error('Нет доступа к геолокации')
        },
        { timeout: 10000, enableHighAccuracy: true }
      )
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
      await supabase.from('driver_status').update({ is_online: false }).eq('driver_id', myId)
      setIsOnline(false)
      setMyPos(null)
      toast('Вы офлайн')
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-3">
              <Link href="/" className="btn-ghost p-2 rounded-xl">
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">Водитель</h1>
                {profile && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <span className="text-xs text-gray-500 dark:text-slate-400">
                        {Number(profile.rating_driver).toFixed(1)} · {profile.total_rides_as_driver} рейсов
                      </span>
                    </div>
                    <span className="text-gray-300">·</span>
                    <LiveIndicator />
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Link href="/driver/earnings" className="btn-ghost p-2 rounded-xl text-sm">💰</Link>
              <Link href="/driver/history"  className="btn-ghost p-2 rounded-xl text-sm">🕐</Link>
              <Link href="/profile"         className="btn-ghost p-2 rounded-xl text-sm">👤</Link>
            </div>
          </div>

          {/* Онлайн переключатель */}
          <button
            onClick={toggleOnline}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${
              isOnline ? 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30' : 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {isOnline ? (
                <>
                  <div className="online-dot" />
                  <span className="text-sm font-medium text-green-700">Онлайн — принимаю заказы</span>
                </>
              ) : (
                <>
                  <div className="w-2.5 h-2.5 bg-gray-400 rounded-full" />
                  <span className="text-sm font-medium text-gray-500 dark:text-slate-400">Офлайн — нажмите чтобы включить</span>
                </>
              )}
            </div>
            {isOnline
              ? <ToggleRight className="w-8 h-8 text-green-600 flex-shrink-0" />
              : <ToggleLeft  className="w-8 h-8 text-gray-400 dark:text-slate-500 flex-shrink-0" />
            }
          </button>
          {geoError && <p className="text-xs text-rose-500 mt-1.5 px-1">{geoError}</p>}
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">

        {/* АКТИВНАЯ ПОЕЗДКА — показываем вверху если есть */}
        {activeRide && (
          <Link href={`/driver/ride/${activeRide.id}`}
            className="block bg-indigo-600 rounded-2xl p-4 shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors active:scale-95"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                <span className="text-white font-bold">
                  {activeRide.status === 'accepted' ? '🚗 Еду к пассажиру' : '🏁 Поездка идёт'}
                </span>
              </div>
              <span className="text-indigo-200 font-bold text-lg">
                {(activeRide.final_price || activeRide.passenger_price).toLocaleString('ru-RU')} ₽
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-indigo-100">
                <div className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0" />
                <span className="truncate">{activeRide.origin_address}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-indigo-200">
                <div className="w-2 h-2 bg-rose-300 rounded-full flex-shrink-0" />
                <span className="truncate">{activeRide.dest_address}</span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-indigo-200 text-xs">
                Пассажир: {activeRide.passenger?.full_name || 'Неизвестен'}
              </span>
              <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-full font-medium">
                Открыть →
              </span>
            </div>
          </Link>
        )}

        {/* Нет авто — предупреждение */}
        {vehicles.length === 0 && (
          <div className="card p-4 border-l-4 border-amber-400">
            <p className="font-semibold text-amber-700 text-sm">Добавьте автомобиль</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 mb-2">Без авто вы не можете принимать заказы</p>
            <Link href="/profile/vehicle/new" className="btn-primary btn-sm inline-flex">
              Добавить авто →
            </Link>
          </div>
        )}

        {/* Переключатель список / карта */}
        <div className="flex gap-2">
          <button onClick={() => setView('list')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              view === 'list' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700'
            }`}>
            <List className="w-4 h-4" /> Список ({rides.length})
          </button>
          <button onClick={() => setView('map')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              view === 'map' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700'
            }`}>
            <Map className="w-4 h-4" /> Карта
          </button>
        </div>

        {/* Карта заказов */}
        {view === 'map' && (
          myPos ? (
            <div className="rounded-2xl overflow-hidden border border-gray-100" style={{ height: '400px' }}>
              <MapWithRides rides={rides} myPos={myPos} apiKey={apiKey} onRideClick={setSelectedRide} />
            </div>
          ) : (
            <div className="card p-8 text-center">
              <Navigation className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-slate-400 font-medium">Включите онлайн-режим</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Для карты нужна геолокация</p>
            </div>
          )
        )}

        {/* Список заказов */}
        {view === 'list' && (
          rides.length === 0 ? (
            <div className="card p-10 text-center">
              <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-slate-400 font-medium">Новых заявок нет</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                {isOnline ? 'Ожидаем заявки поблизости...' : 'Включите онлайн-режим чтобы видеть заказы'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {rides.map(ride => (
                <RideCard key={ride.id} ride={ride} onOffer={setSelectedRide} />
              ))}
            </div>
          )
        )}
      </div>

      {/* Модалка торга */}
      {selectedRide && (
        <OfferModal
          ride={selectedRide}
          myId={myId}
          vehicleId={vehicles[0]?.id}
          onClose={() => setSelectedRide(null)}
        />
      )}
    </div>
  )
}