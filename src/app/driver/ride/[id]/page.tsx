'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  ChevronLeft, Phone, MessageSquare, CheckCircle,
  Star, Send, Navigation, Map
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'

const YandexMap = dynamic(() => import('@/components/map/YandexMap'), { ssr: false })

export default function DriverRidePage() {
  const router   = useRouter()
  const params   = useParams()
  const rideId   = params.id as string
  const supabase = createClient()
  const apiKey   = process.env.NEXT_PUBLIC_YANDEX_MAPS_KEY || ''

  const [ride,     setRide]     = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [myId,     setMyId]     = useState('')
  const [chatMsg,  setChatMsg]  = useState('')
  const [tab,      setTab]      = useState<'map' | 'chat'>('map')
  const [loading,  setLoading]  = useState(true)
  const [myPos,    setMyPos]    = useState<{ lat: number; lng: number } | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const geoRef     = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      setMyId(user.id)

      const { data } = await supabase
        .from('rides')
        .select('*, passenger:profiles!rides_passenger_id_fkey(*)')
        .eq('id', rideId).single()

      if (!data || data.driver_id !== user.id) {
        toast.error('Нет доступа')
        router.replace('/driver')
        return
      }
      setRide(data)

      const { data: msgs } = await supabase
        .from('ride_messages').select('*, sender:profiles(*)')
        .eq('ride_id', rideId).order('created_at')
      setMessages(msgs || [])
      setLoading(false)

      // Запускаем GPS трекинг
      startTracking(user.id)

      const channel = supabase.channel(`driver-ride-${rideId}`)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${rideId}`
        }, ({ new: u }) => setRide((prev: any) => ({ ...prev, ...u })))
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'ride_messages', filter: `ride_id=eq.${rideId}`
        }, async ({ new: msg }) => {
          const { data: m } = await supabase
            .from('ride_messages').select('*, sender:profiles(*)')
            .eq('id', msg.id).single()
          if (m) {
            setMessages(prev => prev.find(x => x.id === m.id) ? prev : [...prev, m])
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
          }
        })
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
        if (geoRef.current) clearInterval(geoRef.current)
      }
    }
    load()
  }, [rideId])

  function startTracking(driverId: string) {
    const opts = { enableHighAccuracy: true, timeout: 10000 }
    const update = () => navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        setMyPos({ lat, lng })
        await supabase.rpc('update_driver_location', {
          p_driver_id: driverId, p_lat: lat, p_lng: lng
        }).catch(() => {})
      },
      () => {}, opts
    )
    update()
    geoRef.current = setInterval(update, 10000) // каждые 10 сек
  }

  async function startRide() {
    const { error } = await supabase.from('rides')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', rideId)
    if (!error) toast.success('🏁 Поездка началась!')
  }

  async function completeRide() {
    if (!confirm('Завершить поездку?')) return
    await supabase.from('rides')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', rideId)
    if (geoRef.current) clearInterval(geoRef.current)
    toast.success('✅ Поездка завершена!')
    router.replace('/driver')
  }

  async function sendMessage() {
    if (!chatMsg.trim()) return
    await supabase.from('ride_messages').insert({
      ride_id: rideId, sender_id: myId, message: chatMsg.trim()
    })
    setChatMsg('')
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent" />
    </div>
  )
  if (!ride) return null

  const passenger  = ride.passenger
  const isAccepted = ride.status === 'accepted'
  const isActive   = ride.status === 'in_progress'
  const isDone     = ride.status === 'completed'

  // Для навигатора:
  // accepted — маршрут от текущей позиции водителя до точки посадки
  // in_progress — маршрут от текущей позиции до точки назначения
  const navOriginLat = myPos?.lat ?? ride.origin_lat
  const navOriginLng = myPos?.lng ?? ride.origin_lng
  const navDestLat   = isAccepted ? ride.origin_lat  : ride.dest_lat
  const navDestLng   = isAccepted ? ride.origin_lng  : ride.dest_lng

  const MAP_HEIGHT = 'calc(100vh - 220px)'

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">

      {/* Шапка */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex-shrink-0">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.replace('/driver')} className="p-2 text-gray-400 hover:text-white">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                {(isAccepted || isActive) && (
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                )}
                <p className="font-bold text-white text-sm">
                  {isAccepted ? '🚗 Еду к пассажиру'
                    : isActive ? '🏁 Поездка идёт'
                    : isDone   ? '✅ Завершено'
                    : 'Поездка'}
                </p>
              </div>
              <p className="text-xs text-gray-400">
                {(ride.final_price || ride.passenger_price || 0).toLocaleString('ru-RU')} ₽
                {myPos ? ' · GPS активен' : ' · Ожидание GPS...'}
              </p>
            </div>
          </div>
          {passenger?.phone && (
            <a href={`tel:${passenger.phone}`}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors">
              <Phone className="w-4 h-4" /> Позвонить
            </a>
          )}
        </div>
      </header>

      {/* Пассажир + маршрут */}
      <div className="bg-gray-800 px-4 py-2.5 flex-shrink-0">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
            {passenger?.avatar_url
              ? <img src={passenger.avatar_url} className="w-9 h-9 object-cover" alt="" />
              : <span className="font-bold text-white text-sm">{passenger?.full_name?.[0] || '?'}</span>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-white text-sm">{passenger?.full_name || 'Пассажир'}</p>
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span className="text-xs text-gray-400">
                {Number(passenger?.rating_passenger || 5).toFixed(1)}
              </span>
            </div>
          </div>
          <div className="text-right min-w-0 max-w-36">
            <p className="text-xs text-gray-400">{isAccepted ? 'Точка посадки' : 'Назначение'}</p>
            <p className="text-xs text-white truncate">
              {isAccepted ? ride.origin_address : ride.dest_address}
            </p>
          </div>
        </div>
      </div>

      {/* Вкладки */}
      <div className="bg-gray-800 px-4 pb-2 flex-shrink-0">
        <div className="max-w-lg mx-auto flex gap-2">
          <button onClick={() => setTab('map')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              tab === 'map' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
            }`}>
            <Map className="w-3.5 h-3.5" /> Навигатор
          </button>
          <button onClick={() => setTab('chat')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              tab === 'chat' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
            }`}>
            <MessageSquare className="w-3.5 h-3.5" /> Чат
          </button>
        </div>
      </div>

      {/* Карта-навигатор */}
      {tab === 'map' && (
        <div className="relative flex-shrink-0" style={{ height: MAP_HEIGHT }}>
          <YandexMap
            mode="navigate"
            apiKey={apiKey}
            driverLat={myPos?.lat ?? navOriginLat}
            driverLng={myPos?.lng ?? navOriginLng}
            originLat={navOriginLat}
            originLng={navOriginLng}
            destLat={navDestLat}
            destLng={navDestLng}
            height={MAP_HEIGHT}
          />
          {/* Оверлей с адресом назначения */}
          <div className="absolute bottom-4 left-4 right-4 z-10 pointer-events-none">
            <div className="bg-white/95 backdrop-blur rounded-2xl p-3 shadow-xl">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">
                    {isAccepted ? 'Едете к точке посадки' : 'Едете к пункту назначения'}
                  </p>
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {isAccepted ? ride.origin_address : ride.dest_address}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Чат */}
      {tab === 'chat' && (
        <div className="flex-shrink-0 flex flex-col bg-gray-50" style={{ height: MAP_HEIGHT }}>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {messages.length === 0
              ? <p className="text-center text-sm text-gray-400 py-8">Напишите пассажиру</p>
              : messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender_id === myId ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${
                    msg.sender_id === myId
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-800 border border-gray-100'
                  }`}>{msg.message}</div>
                </div>
              ))
            }
            <div ref={chatEndRef} />
          </div>
          <div className="bg-white border-t border-gray-200 px-4 py-3 flex gap-2">
            <input value={chatMsg} onChange={e => setChatMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Пишите пассажиру..." className="input py-2 flex-1" />
            <button onClick={sendMessage} disabled={!chatMsg.trim()}
              className="btn-primary px-3 py-2 rounded-xl disabled:opacity-50">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Кнопки действий */}
      {!isDone && (
        <div className="bg-gray-900 px-4 py-3 flex-shrink-0">
          <div className="max-w-lg mx-auto">
            {isAccepted && (
              <button onClick={startRide}
                className="w-full py-4 bg-green-600 hover:bg-green-700 active:scale-95 text-white rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all">
                <Navigation className="w-5 h-5" />
                Пассажир сел — начать поездку
              </button>
            )}
            {isActive && (
              <button onClick={completeRide}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all">
                <CheckCircle className="w-5 h-5" />
                Завершить поездку
              </button>
            )}
          </div>
        </div>
      )}

      {isDone && (
        <div className="bg-gray-900 px-4 py-4 flex-shrink-0 text-center">
          <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-1" />
          <p className="text-white font-bold">Поездка завершена</p>
          <p className="text-gray-400 text-sm">
            {(ride.final_price || ride.passenger_price).toLocaleString('ru-RU')} ₽
          </p>
          <button onClick={() => router.replace('/driver')}
            className="mt-3 text-indigo-400 text-sm hover:underline">
            Вернуться к заказам →
          </button>
        </div>
      )}
    </div>
  )
}
