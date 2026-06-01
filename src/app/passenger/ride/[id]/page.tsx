'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  ChevronLeft, Star, Car, Send, CheckCircle,
  XCircle, Clock, Shield, Phone, Map, Navigation
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import dynamic from 'next/dynamic'

const YandexMap = dynamic(() => import('@/components/map/YandexMap'), { ssr: false })

const STATUS_INFO: Record<string, { label: string; color: string; bg: string }> = {
  searching:   { label: 'Ищем водителей...',   color: 'text-blue-600',   bg: 'bg-blue-50' },
  negotiating: { label: 'Идёт торг',           color: 'text-amber-700',  bg: 'bg-amber-50' },
  accepted:    { label: 'Водитель едет к вам',  color: 'text-green-700',  bg: 'bg-green-50' },
  in_progress: { label: 'Вы в пути!',           color: 'text-indigo-700', bg: 'bg-indigo-50' },
  completed:   { label: 'Поездка завершена',    color: 'text-gray-600',   bg: 'bg-gray-100' },
  cancelled:   { label: 'Отменена',             color: 'text-rose-700',   bg: 'bg-rose-50' },
}

// ── Блок отзыва ────────────────────────────────────────────────
function ReviewBlock({ onSubmit }: { onSubmit: (r: number, c: string) => void }) {
  const [rating,  setRating]  = useState(5)
  const [comment, setComment] = useState('')
  const [sent,    setSent]    = useState(false)
  if (sent) return (
    <div className="card p-4 text-center bg-green-50">
      <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-1" />
      <p className="text-sm font-medium text-green-700">Отзыв отправлен!</p>
    </div>
  )
  return (
    <div className="card p-4 space-y-3">
      <p className="font-semibold text-gray-900">Оцените водителя</p>
      <div className="flex gap-1">
        {[1,2,3,4,5].map(i => (
          <button key={i} type="button" onClick={() => setRating(i)}>
            <Star className={`w-7 h-7 ${i <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
          </button>
        ))}
      </div>
      <textarea value={comment} onChange={e => setComment(e.target.value)}
        placeholder="Комментарий..." className="input resize-none" rows={2} />
      <button onClick={() => { onSubmit(rating, comment); setSent(true) }}
        className="btn-primary w-full">Отправить отзыв</button>
    </div>
  )
}

export default function RideDetailPage() {
  const router   = useRouter()
  const params   = useParams()
  const rideId   = params.id as string
  const supabase = createClient()
  const apiKey   = process.env.NEXT_PUBLIC_YANDEX_MAPS_KEY || ''

  const [ride,      setRide]      = useState<any>(null)
  const [offers,    setOffers]    = useState<any[]>([])
  const [messages,  setMessages]  = useState<any[]>([])
  const [myId,      setMyId]      = useState('')
  const [chatMsg,   setChatMsg]   = useState('')
  const [loading,   setLoading]   = useState(true)
  const [tab,       setTab]       = useState<'offers'|'map'|'chat'>('offers')
  const [driverPos, setDriverPos] = useState<{lat:number;lng:number}|null>(null)
  const chatEndRef  = useRef<HTMLDivElement>(null)
  const rideRef     = useRef<any>(null) // для использования в realtime callback

  // Синхронизируем ref с состоянием чтобы realtime видел актуальный ride
  useEffect(() => { rideRef.current = ride }, [ride])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      setMyId(user.id)

      const { data: rideData } = await supabase
        .from('rides')
        .select('*, passenger:profiles!rides_passenger_id_fkey(*), driver:profiles!rides_driver_id_fkey(*)')
        .eq('id', rideId).single()

      if (!rideData) { router.push('/passenger'); return }
      setRide(rideData)
      rideRef.current = rideData

      // Если поездка уже активна — сразу открываем карту
      if (['accepted', 'in_progress'].includes(rideData.status)) {
        setTab('map')
      }

      const [{ data: offersData }, { data: msgs }] = await Promise.all([
        supabase.from('ride_offers').select('*, driver:profiles(*)')
          .eq('ride_id', rideId).eq('status', 'pending')
          .order('created_at', { ascending: false }),
        supabase.from('ride_messages').select('*, sender:profiles(*)')
          .eq('ride_id', rideId).order('created_at'),
      ])
      setOffers(offersData || [])
      setMessages(msgs || [])

      // Позиция водителя если уже едет
      if (rideData.driver_id) {
        const { data: ds } = await supabase
          .from('driver_status').select('lat,lng')
          .eq('driver_id', rideData.driver_id).single()
        if (ds?.lat) setDriverPos({ lat: ds.lat, lng: ds.lng })
      }

      setLoading(false)

      // ── Realtime подписки ─────────────────────────────────────
      const channel = supabase.channel(`ride-passenger-${rideId}`)

        // Изменения статуса поездки
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'rides',
          filter: `id=eq.${rideId}`,
        }, async ({ new: u }) => {
          // Подгружаем данные водителя если он только что назначен
          if (u.driver_id && !rideRef.current?.driver) {
            const { data: withDriver } = await supabase
              .from('rides')
              .select('*, passenger:profiles!rides_passenger_id_fkey(*), driver:profiles!rides_driver_id_fkey(*)')
              .eq('id', rideId).single()
            if (withDriver) { setRide(withDriver); rideRef.current = withDriver }
          } else {
            setRide((prev: any) => ({ ...prev, ...u }))
          }

          if (u.status === 'accepted') {
            toast.success('🚗 Водитель найден! Едет к вам')
            setTab('map')
          }
          if (u.status === 'in_progress') {
            toast.success('🏁 Поездка началась!')
            setTab('map')
          }
          if (u.status === 'completed') {
            toast.success('✅ Поездка завершена!')
          }
          if (u.status === 'cancelled') {
            toast('Поездка отменена')
          }
        })

        // Новые предложения от водителей
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'ride_offers',
          filter: `ride_id=eq.${rideId}`,
        }, async ({ new: offer }) => {
          const { data } = await supabase
            .from('ride_offers').select('*, driver:profiles(*)')
            .eq('id', offer.id).single()
          if (data) {
            setOffers(prev => {
              // Не дублируем
              if (prev.find(o => o.id === data.id)) return prev
              return [data, ...prev]
            })
            toast.success('💰 Новое предложение от водителя!')
            setTab('offers')
          }
        })

        // Новые сообщения в чате
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'ride_messages',
          filter: `ride_id=eq.${rideId}`,
        }, async ({ new: msg }) => {
          const { data } = await supabase
            .from('ride_messages').select('*, sender:profiles(*)')
            .eq('id', msg.id).single()
          if (data) {
            setMessages(prev => {
              if (prev.find(m => m.id === data.id)) return prev
              return [...prev, data]
            })
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
          }
        })

        // Позиция водителя — обновляется каждые 30 сек
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'driver_status',
          filter: rideData.driver_id ? `driver_id=eq.${rideData.driver_id}` : undefined,
        }, ({ new: ds }: any) => {
          if (ds?.lat) setDriverPos({ lat: ds.lat, lng: ds.lng })
        })

        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Realtime connected for ride:', rideId)
          }
        })

      return () => { supabase.removeChannel(channel) }
    }
    load()
  }, [rideId])

  async function acceptOffer(offer: any) {
    await supabase.from('ride_offers').update({ status: 'accepted' }).eq('id', offer.id)
    await supabase.from('ride_offers').update({ status: 'rejected' })
      .eq('ride_id', rideId).neq('id', offer.id)
    await supabase.from('rides').update({
      status: 'accepted', driver_id: offer.driver_id, final_price: offer.offered_price,
    }).eq('id', rideId)
    setOffers([])
  }

  async function rejectOffer(offerId: string) {
    await supabase.from('ride_offers').update({ status: 'rejected' }).eq('id', offerId)
    setOffers(prev => prev.filter(o => o.id !== offerId))
    toast('Предложение отклонено')
  }

  async function cancelRide() {
    if (!confirm('Отменить заявку?')) return
    await supabase.from('rides').update({ status: 'cancelled' }).eq('id', rideId)
    router.replace('/passenger')
  }

  async function leaveReview(rating: number, comment: string) {
    if (!ride?.driver_id) return
    await supabase.from('reviews').insert({
      ride_id: rideId, reviewer_id: myId, reviewed_id: ride.driver_id,
      role_reviewed: 'driver', rating, comment,
    })
    toast.success('Отзыв оставлен!')
  }

  async function sendMessage() {
    if (!chatMsg.trim()) return
    await supabase.from('ride_messages').insert({
      ride_id: rideId, sender_id: myId, message: chatMsg.trim(),
    })
    setChatMsg('')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
    </div>
  )
  if (!ride) return null

  const si       = STATUS_INFO[ride.status] || STATUS_INFO.searching
  const isActive = ['accepted', 'in_progress'].includes(ride.status)
  const driver   = ride.driver

  // ── Экран активной поездки (принята или в пути) ────────────────
  if (isActive) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        {/* Шапка */}
        <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex-shrink-0">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => router.replace('/passenger')} className="p-2 text-gray-400">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <p className="font-bold text-white text-sm">
                    {ride.status === 'accepted' ? 'Водитель едет к вам' : 'Вы в пути!'}
                  </p>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {(ride.final_price || ride.passenger_price).toLocaleString('ru-RU')} ₽
                </p>
              </div>
            </div>
            {driver?.phone && (
              <a href={`tel:${driver.phone}`}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-xl text-sm font-medium">
                <Phone className="w-4 h-4" /> Позвонить
              </a>
            )}
          </div>
        </header>

        {/* Водитель */}
        {driver && (
          <div className="bg-gray-800 px-4 py-3 flex-shrink-0">
            <div className="max-w-lg mx-auto flex items-center gap-3">
              <div className="w-11 h-11 bg-indigo-600 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                {driver.avatar_url
                  ? <img src={driver.avatar_url} className="w-11 h-11 object-cover" alt="" />
                  : <span className="font-bold text-white text-lg">{driver.full_name?.[0] || '?'}</span>
                }
              </div>
              <div className="flex-1">
                <p className="font-semibold text-white text-sm">{driver.full_name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span className="text-xs text-gray-400">{Number(driver.rating_driver || 5).toFixed(1)}</span>
                  {driver.is_verified && (
                    <span className="flex items-center gap-0.5 text-xs text-green-400">
                      <Shield className="w-3 h-3" /> Проверен
                    </span>
                  )}
                </div>
              </div>
              {/* Маршрут */}
              <div className="text-right max-w-32">
                <p className="text-xs text-gray-400">Куда</p>
                <p className="text-xs text-white truncate">{ride.dest_address}</p>
              </div>
            </div>
          </div>
        )}

        {/* Вкладки */}
        <div className="bg-gray-800 px-4 pb-2 flex-shrink-0">
          <div className="max-w-lg mx-auto flex gap-2">
            {([
              { key: 'map',  label: '🗺 Карта' },
              { key: 'chat', label: '💬 Чат' },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  tab === t.key ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Карта */}
        {tab === 'map' && (
          <div className="relative" style={{ height: 'calc(100vh - 200px)' }}>
            <YandexMap
              mode={driverPos ? 'track' : 'route'}
              apiKey={apiKey}
              driverLat={driverPos?.lat}
              driverLng={driverPos?.lng}
              passengerLat={ride.origin_lat}
              passengerLng={ride.origin_lng}
              originLat={ride.origin_lat}
              originLng={ride.origin_lng}
              destLat={ride.dest_lat}
              destLng={ride.dest_lng}
              height="calc(100vh - 200px)"
            />
            {/* Адрес поверх карты */}
            <div className="absolute bottom-4 left-4 right-4 z-10">
              <div className="bg-white/95 backdrop-blur rounded-2xl p-3 shadow-xl">
                <p className="text-xs text-gray-400 mb-0.5">
                  {ride.status === 'accepted' ? '📍 Водитель едет к точке посадки' : '🏁 Маршрут'}
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                  <span className="text-gray-700 truncate">{ride.origin_address}</span>
                </div>
                <div className="flex items-center gap-2 text-sm mt-1">
                  <div className="w-2 h-2 bg-rose-500 rounded-full flex-shrink-0" />
                  <span className="text-gray-700 truncate">{ride.dest_address}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Чат */}
        {tab === 'chat' && (
          <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {messages.length === 0
                ? <p className="text-center text-sm text-gray-400 py-8">Напишите водителю</p>
                : messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender_id === myId ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${
                      msg.sender_id === myId ? 'bg-indigo-600 text-white' : 'bg-white text-gray-800 border border-gray-100'
                    }`}>{msg.message}</div>
                  </div>
                ))
              }
              <div ref={chatEndRef} />
            </div>
            <div className="bg-white border-t border-gray-100 px-4 py-3 flex gap-2 flex-shrink-0">
              <input value={chatMsg} onChange={e => setChatMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Сообщение водителю..." className="input py-2 flex-1" />
              <button onClick={sendMessage} className="btn-primary px-3 py-2 rounded-xl">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Обычный экран (поиск, торг, завершена, отменена) ───────────
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.replace('/passenger')} className="btn-ghost p-2 rounded-xl">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Поездка</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">

        {/* Статус */}
        <div className={`rounded-2xl p-4 flex items-center gap-3 ${si.bg}`}>
          {ride.status === 'searching' && (
            <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse flex-shrink-0" />
          )}
          {ride.status === 'negotiating' && (
            <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse flex-shrink-0" />
          )}
          <div>
            <p className={`font-semibold ${si.color}`}>{si.label}</p>
            {ride.status === 'searching' && (
              <p className="text-xs text-gray-500 mt-0.5">Водители видят вашу заявку</p>
            )}
          </div>
        </div>

        {/* Маршрут + цена */}
        <div className="card p-4">
          <div className="space-y-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
              <p className="text-sm text-gray-700 truncate">{ride.origin_address}</p>
            </div>
            <div className="ml-1 border-l-2 border-dashed border-gray-200 h-3" />
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-rose-500 rounded-full flex-shrink-0" />
              <p className="text-sm text-gray-700 truncate">{ride.dest_address}</p>
            </div>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-400">Ваша цена</span>
            <span className="font-bold">{ride.passenger_price.toLocaleString('ru-RU')} ₽</span>
          </div>
          {ride.final_price && ride.final_price !== ride.passenger_price && (
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-400">Итого</span>
              <span className="font-bold text-green-700">{ride.final_price.toLocaleString('ru-RU')} ₽</span>
            </div>
          )}
        </div>

        {/* Предложения */}
        {['searching', 'negotiating'].includes(ride.status) && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Предложения {offers.length > 0 && `(${offers.length})`}
            </p>
            {offers.length === 0 ? (
              <div className="card p-8 text-center">
                <Clock className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Ожидаем предложений от водителей</p>
                <p className="text-xs text-gray-400 mt-1">Уведомим как только появятся</p>
              </div>
            ) : (
              <div className="space-y-3">
                {offers.map(offer => (
                  <div key={offer.id} className="card p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden">
                        {offer.driver?.avatar_url
                          ? <img src={offer.driver.avatar_url} className="w-10 h-10 object-cover" alt="" />
                          : <Car className="w-5 h-5 text-gray-500" />
                        }
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{offer.driver?.full_name || 'Водитель'}</p>
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                          <span className="text-xs text-gray-500">
                            {Number(offer.driver?.rating_driver || 5).toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">{offer.offered_price.toLocaleString('ru-RU')} ₽</p>
                        {offer.offered_price !== ride.passenger_price && (
                          <p className={`text-xs ${offer.offered_price > ride.passenger_price ? 'text-rose-500' : 'text-green-600'}`}>
                            {offer.offered_price > ride.passenger_price ? '+' : ''}
                            {(offer.offered_price - ride.passenger_price).toLocaleString('ru-RU')} ₽
                          </p>
                        )}
                      </div>
                    </div>
                    {offer.message && (
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 mb-3">
                        "{offer.message}"
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => acceptOffer(offer)} className="flex-1 btn-primary btn-sm gap-1.5">
                        <CheckCircle className="w-4 h-4" /> Принять
                      </button>
                      <button onClick={() => rejectOffer(offer.id)} className="btn-secondary btn-sm gap-1.5">
                        <XCircle className="w-4 h-4" /> Отклонить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Отзыв после завершения */}
        {ride.status === 'completed' && ride.driver_id && (
          <ReviewBlock onSubmit={leaveReview} />
        )}

        {/* Отмена */}
        {['searching', 'negotiating'].includes(ride.status) && (
          <button onClick={cancelRide} className="w-full btn-secondary text-rose-500 py-3">
            Отменить заявку
          </button>
        )}
      </div>
    </div>
  )
}
