'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { ChevronLeft, Phone, MessageSquare, CheckCircle, Star, Send, Map, Navigation } from 'lucide-react'
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
  const [myPos,    setMyPos]    = useState<{lat:number;lng:number}|null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const geoRef     = useRef<NodeJS.Timeout>()

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
        toast.error('Нет доступа к этой поездке')
        router.push('/driver')
        return
      }
      setRide(data)

      const { data: msgs } = await supabase
        .from('ride_messages').select('*, sender:profiles(*)')
        .eq('ride_id', rideId).order('created_at')
      setMessages(msgs || [])
      setLoading(false)

      // Начинаем отслеживание геолокации водителя
      startTracking(user.id)

      // Realtime — сообщения
      const channel = supabase.channel(`driver-ride-${rideId}`)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${rideId}`
        }, ({ new: u }) => setRide((prev: any) => ({ ...prev, ...u })))
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'ride_messages', filter: `ride_id=eq.${rideId}`
        }, async ({ new: msg }) => {
          const { data } = await supabase.from('ride_messages').select('*, sender:profiles(*)').eq('id', msg.id).single()
          setMessages(prev => [...prev, data])
          setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
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
    async function updatePos() {
      navigator.geolocation.getCurrentPosition(async pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        setMyPos({ lat, lng })
        await supabase.rpc('update_driver_location', { p_driver_id: driverId, p_lat: lat, p_lng: lng })
      }, err => console.log('Geo error:', err), { enableHighAccuracy: true })
    }
    updatePos()
    geoRef.current = setInterval(updatePos, 15000) // каждые 15 сек
  }

  async function startRide() {
    await supabase.from('rides').update({ status: 'in_progress', started_at: new Date().toISOString() }).eq('id', rideId)
    toast.success('Поездка началась!')
  }

  async function completeRide() {
    if (!confirm('Завершить поездку?')) return
    await supabase.from('rides').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', rideId)
    // Обновляем счётчик рейсов
    await supabase.from('profiles').update({ total_rides_as_driver: (ride?.passenger?.total_rides_as_passenger || 0) + 1 }).eq('id', myId)
    toast.success('Поездка завершена!')
    router.push('/driver')
  }

  async function sendMessage() {
    if (!chatMsg.trim()) return
    await supabase.from('ride_messages').insert({ ride_id: rideId, sender_id: myId, message: chatMsg.trim() })
    setChatMsg('')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
    </div>
  )

  const passenger = ride?.passenger
  const isInProgress = ride?.status === 'in_progress'
  const isAccepted   = ride?.status === 'accepted'

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Шапка — тёмная для режима вождения */}
      <header className="bg-gray-900 border-b border-gray-700 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 text-gray-400 hover:text-white">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <p className="font-bold text-white">
                {isAccepted ? '🚗 Еду к пассажиру' : isInProgress ? '🏁 Поездка идёт' : '✅ Завершено'}
              </p>
              <p className="text-xs text-gray-400">
                {(ride?.final_price || ride?.passenger_price || 0).toLocaleString('ru-RU')} ₽
              </p>
            </div>
          </div>
          {passenger?.phone && (
            <a href={`tel:${passenger.phone}`}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-xl text-sm font-medium">
              <Phone className="w-4 h-4" />
              Позвонить
            </a>
          )}
        </div>
      </header>

      {/* Пассажир */}
      <div className="bg-gray-800 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
            {passenger?.avatar_url
              ? <img src={passenger.avatar_url} className="w-10 h-10 object-cover" alt="" />
              : <span className="font-bold text-white">{passenger?.full_name?.[0] || '?'}</span>
            }
          </div>
          <div className="flex-1">
            <p className="font-semibold text-white text-sm">{passenger?.full_name || 'Пассажир'}</p>
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span className="text-xs text-gray-400">{Number(passenger?.rating_passenger || 5).toFixed(1)}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Откуда</p>
            <p className="text-xs text-white truncate max-w-32">{ride?.origin_address}</p>
          </div>
        </div>
      </div>

      {/* Вкладки */}
      <div className="bg-gray-800 px-4 pb-2">
        <div className="max-w-lg mx-auto flex gap-2">
          <button onClick={() => setTab('map')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              tab === 'map' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
            }`}>
            <Map className="w-3.5 h-3.5" /> Карта
          </button>
          <button onClick={() => setTab('chat')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              tab === 'chat' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
            }`}>
            <MessageSquare className="w-3.5 h-3.5" /> Чат
          </button>
        </div>
      </div>

      {/* Карта */}
      {tab === 'map' && (
        <div className="flex-1 relative">
          {myPos ? (
            <YandexMap
              mode="track"
              apiKey={apiKey}
              driverLat={myPos.lat}
              driverLng={myPos.lng}
              passengerLat={isAccepted ? ride.origin_lat : ride.dest_lat}
              passengerLng={isAccepted ? ride.origin_lng : ride.dest_lng}
              height="100%"
            />
          ) : (
            <YandexMap
              mode="route"
              apiKey={apiKey}
              originLat={ride.origin_lat}
              originLng={ride.origin_lng}
              destLat={ride.dest_lat}
              destLng={ride.dest_lng}
              height="100%"
            />
          )}
          {/* Адрес назначения поверх карты */}
          <div className="absolute bottom-4 left-4 right-4">
            <div className="bg-white/95 backdrop-blur rounded-2xl p-3 shadow-xl">
              <p className="text-xs text-gray-400 mb-0.5">
                {isAccepted ? 'Еду к пассажиру' : 'Маршрут назначения'}
              </p>
              <p className="text-sm font-semibold text-gray-900 truncate">
                {isAccepted ? ride.origin_address : ride.dest_address}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Чат */}
      {tab === 'chat' && (
        <div className="flex-1 flex flex-col bg-gray-50">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2" style={{ maxHeight: 'calc(100vh - 350px)' }}>
            {messages.length === 0
              ? <p className="text-center text-sm text-gray-400 py-8">Напишите пассажиру</p>
              : messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender_id === myId ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${
                    msg.sender_id === myId ? 'bg-indigo-600 text-white' : 'bg-white text-gray-800 border border-gray-100'
                  }`}>
                    {msg.message}
                  </div>
                </div>
              ))
            }
            <div ref={chatEndRef} />
          </div>
          <div className="border-t border-gray-200 bg-white px-4 py-3 flex gap-2">
            <input value={chatMsg} onChange={e => setChatMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Сообщение пассажиру..." className="input py-2 flex-1" />
            <button onClick={sendMessage} className="btn-primary px-3 py-2 rounded-xl">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Кнопки действий */}
      <div className="bg-gray-900 px-4 py-4 safe-area-inset-bottom">
        <div className="max-w-lg mx-auto space-y-2">
          {isAccepted && (
            <button onClick={startRide}
              className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-colors">
              <Navigation className="w-6 h-6" />
              Начать поездку
            </button>
          )}
          {isInProgress && (
            <button onClick={completeRide}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-colors">
              <CheckCircle className="w-6 h-6" />
              Завершить поездку
            </button>
          )}
          {ride?.status === 'completed' && (
            <div className="text-center py-3">
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <p className="text-white font-bold text-lg">Поездка завершена!</p>
              <p className="text-gray-400 text-sm mt-1">
                Заработано: {(ride.final_price || ride.passenger_price).toLocaleString('ru-RU')} ₽
              </p>
              <button onClick={() => router.push('/driver')} className="mt-3 text-indigo-400 text-sm hover:underline">
                Вернуться к заказам
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
