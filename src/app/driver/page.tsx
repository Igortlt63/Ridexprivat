'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  MapPin, Star, Users, Luggage, PawPrint, CigaretteOff,
  MessageSquare, ToggleLeft, ToggleRight, Clock,
  Banknote, Car, Map, List, ChevronLeft, Navigation
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import LiveIndicator from '@/components/ui/LiveIndicator'
import type { Ride, Profile, DriverVehicle } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import dynamic from 'next/dynamic'

const YandexMap = dynamic(() => import('@/components/map/YandexMap'), { ssr: false })

// ── Модалка торга ──────────────────────────────────────────────
function OfferModal({ ride, myId, vehicleId, onClose }: {
  ride: Ride; myId: string; vehicleId?: string; onClose: () => void
}) {
  const supabase = createClient()
  const [price,   setPrice]   = useState(ride.passenger_price)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  async function send() {
    setSending(true)
    const { error } = await supabase.from('ride_offers').insert({
      ride_id:       ride.id,
      driver_id:     myId,
      vehicle_id:    vehicleId || null,
      offered_price: price,
      message:       message.trim() || null,
      status:        'pending',
    })
    if (!error) {
      await supabase.from('rides').update({ status: 'negotiating' }).eq('id', ride.id)
      toast.success('Предложение отправлено!')
    } else {
      toast.error('Ошибка: ' + error.message)
    }
    setSending(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
        <h3 className="font-bold text-lg text-gray-900 mb-4">Предложить цену</h3>
        <div className="mb-3 p-3 bg-gray-50 rounded-xl">
          <p className="text-xs text-gray-400 mb-0.5">Цена пассажира</p>
          <p className="font-bold text-gray-900">{ride.passenger_price.toLocaleString('ru-RU')} ₽</p>
        </div>
        <div className="mb-3">
          <label className="label">Ваша цена (₽)</label>
          <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))}
            className="input text-lg font-semibold" min={1} />
        </div>
        <div className="mb-5">
          <label className="label">Сообщение пассажиру</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)}
            placeholder="Расскажите о себе или авто..." className="input resize-none" rows={2} />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 btn-secondary">Отмена</button>
          <button onClick={send} disabled={sending} className="flex-1 btn-primary">
            {sending ? '...' : 'Отправить'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Карточка заявки ────────────────────────────────────────────
function RideCard({ ride, onOffer }: { ride: any; onOffer: (r: Ride) => void }) {
  return (
    <div className="card p-4 animate-fade-in">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
          {ride.passenger?.avatar_url
            ? <img src={ride.passenger.avatar_url} className="w-9 h-9 object-cover" alt="" />
            : <span className="text-sm font-bold text-indigo-700">{ride.passenger?.full_name?.[0] || '?'}</span>
          }
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm text-gray-900">{ride.passenger?.full_name || 'Пассажир'}</p>
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span className="text-xs text-gray-500">{Number(ride.passenger?.rating_passenger || 5).toFixed(1)}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-lg text-gray-900">{ride.passenger_price.toLocaleString('ru-RU')} ₽</p>
          <p className="text-xs text-gray-400">
            {formatDistanceToNow(new Date(ride.created_at), { addSuffix: true, locale: ru })}
          </p>
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-3 mb-3 space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
          <span className="truncate">{ride.origin_address}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <div className="w-2 h-2 bg-rose-500 rounded-full flex-shrink-0" />
          <span className="truncate">{ride.dest_address}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {ride.seats_needed > 1 && (
          <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
            <Users className="w-3 h-3" /> {ride.seats_needed} места
          </span>
        )}
        {ride.allow_luggage && (
          <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
            <Luggage className="w-3 h-3" /> Багаж
          </span>
        )}
        {ride.allow_pets && (
          <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
            <PawPrint className="w-3 h-3" /> Животное
          </span>
        )}
        {ride.no_smoking && (
          <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
            <CigaretteOff className="w-3 h-3" /> Не курить
          </span>
        )}
        {ride.ride_type === 'intercity' && (
          <span className="badge-primary text-xs">Межгород</span>
        )}
      </div>

      {ride.comment && (
        <div className="flex gap-2 mb-3 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
          <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <p className="line-clamp-2">{ride.comment}</p>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={() => onOffer(ride)} className="flex-1 btn-primary btn-sm">
          Принять — {ride.passenger_price.toLocaleString('ru-RU')} ₽
        </button>
        <button onClick={() => onOffer(ride)} className="btn-secondary btn-sm px-3" title="Предложить другую цену">
          <Banknote className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ── Карта с заказами ───────────────────────────────────────────
function MapWithRides({
  rides, myPos, apiKey, onRideClick
}: {
  rides: Ride[]
  myPos: { lat: number; lng: number }
  apiKey: string
  onRideClick: (r: Ride) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!window.ymaps || !containerRef.current) return
    const ymaps = window.ymaps
    const map = new ymaps.Map(containerRef.current, {
      center: [myPos.lat, myPos.lng], zoom: 12,
      controls: ['zoomControl', 'geolocationControl'],
    })

    // Маркер водителя
    map.geoObjects.add(new ymaps.Placemark(
      [myPos.lat, myPos.lng],
      { balloonContent: 'Вы' },
      { preset: 'islands#blueCarIcon' }
    ))

    // Маркеры заказов
    rides.forEach(ride => {
      const mark = new ymaps.Placemark(
        [ride.origin_lat, ride.origin_lng],
        {
          balloonContent: `<b>${ride.origin_address}</b><br/>→ ${ride.dest_address}<br/><b style="color:#4F46E5">${ride.passenger_price.toLocaleString('ru-RU')} ₽</b>`,
          hintContent: `${ride.passenger_price.toLocaleString('ru-RU')} ₽`,
        },
        {
          preset: 'islands#redCircleDotIconWithCaption',
          iconCaption: `${ride.passenger_price.toLocaleString('ru-RU')}₽`,
        }
      )
      mark.events.add('click', () => onRideClick(ride))
      map.geoObjects.add(mark)
    })

    return () => { try { map.destroy() } catch {} }
  }, [rides, myPos, apiKey])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}

// ── Главный компонент ──────────────────────────────────────────
export default function DriverPage() {
  const router   = useRouter()
  const supabase = createClient()
  const apiKey   = process.env.NEXT_PUBLIC_YANDEX_MAPS_KEY || ''

  const [profile,      setProfile]      = useState<Profile | null>(null)
  const [myId,         setMyId]         = useState('')
  const [isOnline,     setIsOnline]     = useState(false)
  const [rides,        setRides]        = useState<Ride[]>([])
  const [activeRide,   setActiveRide]   = useState<any>(null) // принятая/активная поездка
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [vehicles,     setVehicles]     = useState<DriverVehicle[]>([])
  const [view,         setView]         = useState<'list' | 'map'>('list')
  const [myPos,        setMyPos]        = useState<{ lat: number; lng: number } | null>(null)
  const [geoError,     setGeoError]     = useState('')
  const intervalRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      setMyId(user.id)

      const [{ data: prof }, { data: vehs }, { data: statusData }, { data: ridesData }, { data: activeData }] =
        await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).single(),
          supabase.from('driver_vehicles').select('*').eq('driver_id', user.id).eq('is_active', true),
          supabase.from('driver_status').select('is_online').eq('driver_id', user.id).single(),
          supabase.from('rides')
            .select('*, passenger:profiles!rides_passenger_id_fkey(*)')
            .eq('status', 'searching')
            .order('created_at', { ascending: false })
            .limit(20),
          // Ищем текущую активную поездку водителя
          supabase.from('rides')
            .select('*, passenger:profiles!rides_passenger_id_fkey(*)')
            .eq('driver_id', user.id)
            .in('status', ['accepted', 'in_progress'])
            .single(),
        ])

      setProfile(prof)
      setVehicles(vehs || [])
      setIsOnline(statusData?.is_online || false)
      setRides(ridesData || [])
      if (activeData) setActiveRide(activeData)
      setLoading(false)

      // Realtime — новые заявки
      const channel = supabase.channel('driver-rides')
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'rides',
        }, async ({ new: ride }) => {
          if (ride.status !== 'searching') return
          const { data } = await supabase
            .from('rides').select('*, passenger:profiles!rides_passenger_id_fkey(*)')
            .eq('id', ride.id).single()
          if (data) {
            setRides(prev => [data, ...prev])
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
              setActiveRide(full)
              if (u.status === 'accepted') {
                toast.success('✅ Пассажир принял ваше предложение!')
                // Автопереход на экран поездки
                router.push(`/driver/ride/${u.id}`)
              }
            }
          }
          // Сбрасываем если поездка завершена/отменена
          if (['completed', 'cancelled'].includes(u.status)) {
            setActiveRide((prev: any) => prev?.id === u.id ? null : prev)
          }
        })
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }
    load()
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-3">
              <Link href="/" className="btn-ghost p-2 rounded-xl">
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Водитель</h1>
                {profile && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <span className="text-xs text-gray-500">
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
              isOnline ? 'bg-green-50 hover:bg-green-100' : 'bg-gray-100 hover:bg-gray-200'
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
                  <span className="text-sm font-medium text-gray-500">Офлайн — нажмите чтобы включить</span>
                </>
              )}
            </div>
            {isOnline
              ? <ToggleRight className="w-8 h-8 text-green-600 flex-shrink-0" />
              : <ToggleLeft  className="w-8 h-8 text-gray-400 flex-shrink-0" />
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
            <p className="text-xs text-gray-500 mt-0.5 mb-2">Без авто вы не можете принимать заказы</p>
            <Link href="/profile/vehicle/new" className="btn-primary btn-sm inline-flex">
              Добавить авто →
            </Link>
          </div>
        )}

        {/* Переключатель список / карта */}
        <div className="flex gap-2">
          <button onClick={() => setView('list')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              view === 'list' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}>
            <List className="w-4 h-4" /> Список ({rides.length})
          </button>
          <button onClick={() => setView('map')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              view === 'map' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
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
              <p className="text-gray-500 font-medium">Включите онлайн-режим</p>
              <p className="text-xs text-gray-400 mt-1">Для карты нужна геолокация</p>
            </div>
          )
        )}

        {/* Список заказов */}
        {view === 'list' && (
          rides.length === 0 ? (
            <div className="card p-10 text-center">
              <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Новых заявок нет</p>
              <p className="text-xs text-gray-400 mt-1">
                {isOnline ? 'Ожидаем заявки поблизости...' : 'Включите онлайн-режим чтобы видеть заказы'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {rides.map(ride => (
                <RideCard key={ride.id} ride={ride as any} onOffer={setSelectedRide} />
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