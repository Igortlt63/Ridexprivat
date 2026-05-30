'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  MapPin, Star, Users, Luggage, PawPrint, CigaretteOff,
  MessageSquare, ToggleLeft, ToggleRight, Clock,
  Banknote, Car, Map, List, ChevronRight
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Ride, Profile, DriverVehicle } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import dynamic from 'next/dynamic'

const YandexMap = dynamic(() => import('@/components/map/YandexMap'), { ssr: false })

// ── Модалка предложения цены ───────────────────────────────────
function OfferModal({ ride, myId, onClose }: { ride: Ride; myId: string; onClose: () => void }) {
  const supabase = createClient()
  const [price,   setPrice]   = useState(ride.passenger_price)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  async function send() {
    setSending(true)
    await supabase.from('ride_offers').insert({
      ride_id: ride.id, driver_id: myId,
      offered_price: price, message: message.trim() || null, status: 'pending',
    })
    await supabase.from('rides').update({ status: 'negotiating' }).eq('id', ride.id)
    setSending(false)
    toast.success('Предложение отправлено!')
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
        {ride.seats_needed > 1 && <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full"><Users className="w-3 h-3" /> {ride.seats_needed} места</span>}
        {ride.allow_luggage && <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full"><Luggage className="w-3 h-3" /> Багаж</span>}
        {ride.allow_pets    && <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full"><PawPrint className="w-3 h-3" /> Животное</span>}
        {ride.no_smoking    && <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full"><CigaretteOff className="w-3 h-3" /> Не курить</span>}
        {ride.ride_type === 'intercity' && <span className="badge-primary">Межгород</span>}
      </div>

      {ride.comment && (
        <div className="flex gap-2 mb-3 text-xs text-gray-500">
          <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <p className="line-clamp-2">{ride.comment}</p>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={() => onOffer(ride)} className="flex-1 btn-primary btn-sm">
          Принять — {ride.passenger_price.toLocaleString('ru-RU')} ₽
        </button>
        <button onClick={() => onOffer(ride)} className="btn-secondary btn-sm px-3" title="Предложить свою цену">
          <Banknote className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export default function DriverPage() {
  const router   = useRouter()
  const supabase = createClient()
  const apiKey   = process.env.NEXT_PUBLIC_YANDEX_MAPS_KEY || ''

  const [profile,      setProfile]      = useState<Profile | null>(null)
  const [myId,         setMyId]         = useState('')
  const [isOnline,     setIsOnline]     = useState(false)
  const [rides,        setRides]        = useState<Ride[]>([])
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [vehicles,     setVehicles]     = useState<DriverVehicle[]>([])
  const [view,         setView]         = useState<'list' | 'map'>('list')
  const [myPos,        setMyPos]        = useState<{lat:number;lng:number}|null>(null)
  const [geoError,     setGeoError]     = useState('')
  const intervalRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      setMyId(user.id)

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      const { data: vehs } = await supabase.from('driver_vehicles').select('*').eq('driver_id', user.id).eq('is_active', true)
      setVehicles(vehs || [])

      const { data: status } = await supabase.from('driver_status').select('is_online').eq('driver_id', user.id).single()
      setIsOnline(status?.is_online || false)

      const { data: ridesData } = await supabase
        .from('rides')
        .select('*, passenger:profiles!rides_passenger_id_fkey(*)')
        .eq('status', 'searching')
        .order('created_at', { ascending: false })
        .limit(20)
      setRides(ridesData || [])
      setLoading(false)

      // Realtime
      const channel = supabase.channel('driver-rides')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rides', filter: `status=eq.searching` },
          async ({ new: ride }) => {
            const { data } = await supabase.from('rides')
              .select('*, passenger:profiles!rides_passenger_id_fkey(*)')
              .eq('id', ride.id).single()
            if (data) { setRides(prev => [data, ...prev]); toast('📍 Новая заявка!', { icon: '🚗' }) }
          })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides' },
          ({ new: u }) => { if (u.status !== 'searching') setRides(prev => prev.filter(r => r.id !== u.id)) })
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
        async (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords
          setMyPos({ lat, lng })
          await supabase.rpc('update_driver_location', { p_driver_id: myId, p_lat: lat, p_lng: lng })
          setIsOnline(true)
          toast.success('Вы онлайн!')
          // Обновляем геолокацию каждые 30 секунд
          intervalRef.current = setInterval(async () => {
            navigator.geolocation.getCurrentPosition(async p => {
              setMyPos({ lat: p.coords.latitude, lng: p.coords.longitude })
              await supabase.rpc('update_driver_location', {
                p_driver_id: myId, p_lat: p.coords.latitude, p_lng: p.coords.longitude
              })
            })
          }, 30000)
        },
        () => { setGeoError('Разрешите доступ к геолокации'); toast.error('Нет доступа к геолокации') }
      )
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
      await supabase.from('driver_status').update({ is_online: false }).eq('driver_id', myId)
      setIsOnline(false)
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
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Link href="/" className="btn-ghost p-2 rounded-xl">
                <ChevronRight className="w-5 h-5 rotate-180" />
              </Link>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Водитель</h1>
                {profile && (
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <span className="text-xs text-gray-500">{Number(profile.rating_driver).toFixed(1)}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Link href="/driver/earnings" className="btn-ghost p-2 rounded-xl text-xs">💰</Link>
              <Link href="/driver/history"  className="btn-ghost p-2 rounded-xl text-xs">🕐</Link>
            </div>
          </div>

          {/* Онлайн переключатель */}
          <div className={`rounded-xl p-3 flex items-center justify-between ${isOnline ? 'bg-green-50' : 'bg-gray-100'}`}>
            <div className="flex items-center gap-2">
              {isOnline ? (
                <><div className="online-dot" /><span className="text-sm font-medium text-green-700">Онлайн — принимаю заказы</span></>
              ) : (
                <span className="text-sm font-medium text-gray-500">Офлайн</span>
              )}
            </div>
            <button onClick={toggleOnline} className="transition-transform active:scale-90">
              {isOnline
                ? <ToggleRight className="w-8 h-8 text-green-600" />
                : <ToggleLeft  className="w-8 h-8 text-gray-400" />
              }
            </button>
          </div>
          {geoError && <p className="text-xs text-rose-500 mt-1">{geoError}</p>}
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Нет авто */}
        {vehicles.length === 0 && (
          <div className="card p-4 border-l-4 border-amber-500">
            <p className="font-semibold text-amber-700 text-sm">Добавьте автомобиль</p>
            <p className="text-xs text-gray-500 mt-0.5">Без авто вы не сможете принимать заказы</p>
            <Link href="/profile/vehicle/new" className="btn-primary btn-sm mt-3 inline-flex">
              Добавить авто →
            </Link>
          </div>
        )}

        {/* Переключатель список/карта */}
        <div className="flex gap-2">
          <button onClick={() => setView('list')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors ${view==='list' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            <List className="w-4 h-4" /> Список ({rides.length})
          </button>
          <button onClick={() => setView('map')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors ${view==='map' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            <Map className="w-4 h-4" /> Карта
          </button>
        </div>

        {/* Карта заказов */}
        {view === 'map' && (
          <div>
            {myPos ? (
              <div className="rounded-2xl overflow-hidden" style={{ height: '400px' }}>
                <MapWithRides rides={rides} myPos={myPos} apiKey={apiKey} onRideClick={setSelectedRide} />
              </div>
            ) : (
              <div className="card p-8 text-center">
                <MapPin className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Включите онлайн-режим</p>
                <p className="text-xs text-gray-400 mt-1">Для показа карты нужна геолокация</p>
              </div>
            )}
          </div>
        )}

        {/* Список заказов */}
        {view === 'list' && (
          rides.length === 0 ? (
            <div className="card p-10 text-center">
              <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500">Новых заявок нет</p>
              <p className="text-xs text-gray-400 mt-1">
                {isOnline ? 'Ожидаем заявки поблизости' : 'Включите онлайн-режим'}
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

      {selectedRide && (
        <OfferModal ride={selectedRide} myId={myId} onClose={() => setSelectedRide(null)} />
      )}
    </div>
  )
}

// Карта с метками заказов
function MapWithRides({ rides, myPos, apiKey, onRideClick }: {
  rides: Ride[], myPos: {lat:number;lng:number}, apiKey: string, onRideClick: (r:Ride)=>void
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!window.ymaps || !containerRef.current) return
    const ymaps = window.ymaps
    const map = new ymaps.Map(containerRef.current, { center: [myPos.lat, myPos.lng], zoom: 12, controls: ['zoomControl'] })

    // Маркер водителя
    map.geoObjects.add(new ymaps.Placemark([myPos.lat, myPos.lng], { balloonContent: 'Вы' }, { preset: 'islands#blueCarIcon' }))

    // Маркеры заказов
    rides.forEach(ride => {
      const mark = new ymaps.Placemark(
        [ride.origin_lat, ride.origin_lng],
        {
          balloonContent: `${ride.origin_address} → ${ride.dest_address}<br/><b>${ride.passenger_price.toLocaleString('ru-RU')} ₽</b>`,
          hintContent: `${ride.passenger_price.toLocaleString('ru-RU')} ₽`,
        },
        { preset: 'islands#redCircleDotIconWithCaption', iconCaption: `${ride.passenger_price.toLocaleString('ru-RU')}₽` }
      )
      mark.events.add('click', () => onRideClick(ride))
      map.geoObjects.add(mark)
    })

    return () => { try { map.destroy() } catch {} }
  }, [rides, myPos])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
