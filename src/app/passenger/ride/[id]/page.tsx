'use client'

// src/app/passenger/ride/[id]/page.tsx
// Детали заявки — торг с водителями, статус, чат

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  ChevronLeft, Star, Car, MapPin, Send,
  CheckCircle, XCircle, Clock, Shield
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Ride, RideOffer, RideMessage, Profile } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'

const STATUS_INFO = {
  searching:   { label: 'Ищем водителей...', color: 'text-blue-600',   bg: 'bg-blue-50' },
  negotiating: { label: 'Идёт торг',         color: 'text-yellow-700', bg: 'bg-yellow-50' },
  accepted:    { label: 'Водитель найден',    color: 'text-green-700',  bg: 'bg-green-50' },
  in_progress: { label: 'Вы в пути!',         color: 'text-primary-700', bg: 'bg-primary-50' },
  completed:   { label: 'Поездка завершена',  color: 'text-gray-600',   bg: 'bg-gray-100' },
  cancelled:   { label: 'Отменена',           color: 'text-danger-700', bg: 'bg-danger-50' },
}

export default function RideDetailPage() {
  const router = useRouter()
  const params = useParams()
  const rideId = params.id as string
  const supabase = createClient()

  const [ride, setRide]         = useState<Ride | null>(null)
  const [offers, setOffers]     = useState<RideOffer[]>([])
  const [messages, setMessages] = useState<RideMessage[]>([])
  const [myId, setMyId]         = useState<string>('')
  const [chatMsg, setChatMsg]   = useState('')
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<'status' | 'chat'>('status')
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      setMyId(user.id)

      // Загрузка поездки
      const { data: rideData } = await supabase
        .from('rides')
        .select('*, passenger:profiles!rides_passenger_id_fkey(*), driver:profiles!rides_driver_id_fkey(*)')
        .eq('id', rideId)
        .single()
      setRide(rideData)

      // Загрузка предложений
      const { data: offersData } = await supabase
        .from('ride_offers')
        .select('*, driver:profiles(*)')
        .eq('ride_id', rideId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      setOffers(offersData || [])

      // Загрузка сообщений
      const { data: msgs } = await supabase
        .from('ride_messages')
        .select('*, sender:profiles(*)')
        .eq('ride_id', rideId)
        .order('created_at')
      setMessages(msgs || [])
      setLoading(false)

      // Realtime подписки
      const rideChannel = supabase.channel(`ride-${rideId}`)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'rides',
          filter: `id=eq.${rideId}`,
        }, ({ new: updated }) => setRide(prev => ({ ...prev!, ...updated })))
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'ride_offers',
          filter: `ride_id=eq.${rideId}`,
        }, async ({ new: offer }) => {
          // Догружаем профиль водителя
          const { data: offerWithDriver } = await supabase
            .from('ride_offers').select('*, driver:profiles(*)')
            .eq('id', offer.id).single()
          setOffers(prev => [offerWithDriver, ...prev])
          toast.success('Новое предложение от водителя!')
        })
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'ride_messages',
          filter: `ride_id=eq.${rideId}`,
        }, async ({ new: msg }) => {
          const { data: msgWithSender } = await supabase
            .from('ride_messages').select('*, sender:profiles(*)')
            .eq('id', msg.id).single()
          setMessages(prev => [...prev, msgWithSender])
          setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        })
        .subscribe()

      return () => { supabase.removeChannel(rideChannel) }
    }
    load()
  }, [rideId])

  // ── Принять предложение ────────────────────────────────────
  async function acceptOffer(offer: RideOffer) {
    const { error } = await supabase.rpc('accept_ride_offer', {
      p_offer_id: offer.id,
      p_ride_id: rideId,
      p_driver_id: offer.driver_id,
      p_final_price: offer.offered_price,
    })

    // Если RPC нет — делаем напрямую
    if (error) {
      await supabase.from('ride_offers').update({ status: 'accepted' }).eq('id', offer.id)
      await supabase.from('ride_offers').update({ status: 'rejected' })
        .eq('ride_id', rideId).neq('id', offer.id)
      await supabase.from('rides').update({
        status: 'accepted',
        driver_id: offer.driver_id,
        final_price: offer.offered_price,
      }).eq('id', rideId)
    }
    toast.success('Водитель принят!')
    setOffers([])
  }

  // ── Отклонить предложение ──────────────────────────────────
  async function rejectOffer(offerId: string) {
    await supabase.from('ride_offers').update({ status: 'rejected' }).eq('id', offerId)
    setOffers(prev => prev.filter(o => o.id !== offerId))
    toast('Предложение отклонено')
  }

  // ── Отменить поездку ───────────────────────────────────────
  async function cancelRide() {
    if (!confirm('Отменить заявку?')) return
    await supabase.from('rides').update({ status: 'cancelled' }).eq('id', rideId)
    router.push('/passenger')
  }

  // ── Отправить сообщение ────────────────────────────────────
  async function sendMessage() {
    if (!chatMsg.trim()) return
    await supabase.from('ride_messages').insert({
      ride_id: rideId,
      sender_id: myId,
      message: chatMsg.trim(),
    })
    setChatMsg('')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
      </div>
    )
  }
  if (!ride) return <div className="p-8 text-center text-gray-500">Заявка не найдена</div>

  const statusInfo = STATUS_INFO[ride.status] || STATUS_INFO.searching

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Шапка */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => router.back()} className="btn-ghost p-2 rounded-xl">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Заявка на поездку</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto w-full px-4 py-5 space-y-4 flex-1">
        {/* Статус */}
        <div className={`rounded-2xl p-4 ${statusInfo.bg}`}>
          <div className="flex items-center gap-3">
            {ride.status === 'searching' && (
              <div className="animate-pulse w-3 h-3 bg-blue-500 rounded-full" />
            )}
            <p className={`font-semibold ${statusInfo.color}`}>{statusInfo.label}</p>
          </div>
          {ride.status === 'searching' && (
            <p className="text-sm text-gray-500 mt-1">
              Водители в радиусе 15 км видят вашу заявку
            </p>
          )}
        </div>

        {/* Маршрут и цена */}
        <div className="card p-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-success-500 rounded-full" />
              <div>
                <p className="text-xs text-gray-400">Откуда</p>
                <p className="text-sm font-medium text-gray-800">{ride.origin_address}</p>
              </div>
            </div>
            <div className="ml-1 border-l border-dashed border-gray-200 h-4" />
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-danger-500 rounded-full" />
              <div>
                <p className="text-xs text-gray-400">Куда</p>
                <p className="text-sm font-medium text-gray-800">{ride.dest_address}</p>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
            <span className="text-xs text-gray-400">Ваша цена</span>
            <span className="font-bold text-gray-900">
              {ride.passenger_price.toLocaleString('ru-RU')} ₽
            </span>
          </div>
          {ride.final_price && ride.final_price !== ride.passenger_price && (
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-gray-400">Итоговая цена</span>
              <span className="font-bold text-success-700">
                {ride.final_price.toLocaleString('ru-RU')} ₽
              </span>
            </div>
          )}
        </div>

        {/* Принятый водитель */}
        {ride.driver && ['accepted', 'in_progress'].includes(ride.status) && (
          <div className="card p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-success-100 rounded-xl flex items-center justify-center">
                <Car className="w-6 h-6 text-success-700" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{(ride.driver as Profile).full_name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Star className="w-3.5 h-3.5 text-warning-500" fill="currentColor" />
                  <span className="text-xs text-gray-500">
                    {Number((ride.driver as Profile).rating_driver).toFixed(1)}
                  </span>
                  <span className="mx-1 text-gray-300">·</span>
                  <Shield className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-500">Проверен</span>
                </div>
              </div>
              <button
                onClick={() => setTab('chat')}
                className="ml-auto btn-secondary btn-sm"
              >
                Написать
              </button>
            </div>
          </div>
        )}

        {/* Вкладки */}
        {ride.driver && (
          <div className="flex gap-2">
            {(['status', 'chat'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                  tab === t ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                {t === 'status' ? 'Предложения' : '💬 Чат'}
              </button>
            ))}
          </div>
        )}

        {/* Предложения водителей */}
        {(!ride.driver || tab === 'status') && (
          <section>
            {offers.length > 0 ? (
              <>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Предложения ({offers.length})
                </h3>
                <div className="space-y-3">
                  {offers.map(offer => (
                    <div key={offer.id} className="card p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                          <Car className="w-5 h-5 text-gray-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-gray-900">
                            {(offer.driver as Profile)?.full_name || 'Водитель'}
                          </p>
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-warning-500" fill="currentColor" />
                            <span className="text-xs text-gray-500">
                              {Number((offer.driver as Profile)?.rating_driver || 5).toFixed(1)}
                            </span>
                          </div>
                        </div>
                        <div className="ml-auto text-right">
                          <p className="font-bold text-lg text-gray-900">
                            {offer.offered_price.toLocaleString('ru-RU')} ₽
                          </p>
                          {offer.offered_price !== ride.passenger_price && (
                            <p className="text-xs text-gray-400">
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
                        <button
                          onClick={() => acceptOffer(offer)}
                          className="flex-1 btn-primary btn-sm gap-2"
                        >
                          <CheckCircle className="w-4 h-4" /> Принять
                        </button>
                        <button
                          onClick={() => rejectOffer(offer.id)}
                          className="btn-secondary btn-sm gap-2"
                        >
                          <XCircle className="w-4 h-4" /> Отклонить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : ride.status === 'searching' ? (
              <div className="card p-8 text-center">
                <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Ожидаем предложений</p>
                <p className="text-xs text-gray-400 mt-1">Водители поблизости увидят заявку</p>
              </div>
            ) : null}
          </section>
        )}

        {/* Чат */}
        {tab === 'chat' && ride.driver && (
          <section className="card flex flex-col" style={{ minHeight: '300px' }}>
            <div className="flex-1 p-4 space-y-3 overflow-y-auto" style={{ maxHeight: '360px' }}>
              {messages.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">Напишите водителю</p>
              ) : messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_id === myId ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${
                    msg.sender_id === myId
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {msg.message}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="border-t border-gray-100 p-3 flex gap-2">
              <input
                value={chatMsg}
                onChange={e => setChatMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Сообщение..."
                className="input py-2 flex-1"
              />
              <button onClick={sendMessage} className="btn-primary px-3 py-2 rounded-xl">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </section>
        )}

        {/* Кнопка отмены */}
        {['searching', 'negotiating'].includes(ride.status) && (
          <button onClick={cancelRide} className="w-full btn-secondary text-danger-500 py-3">
            Отменить заявку
          </button>
        )}
      </div>
    </div>
  )
}
