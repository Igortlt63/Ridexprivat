'use client'

// src/app/driver/page.tsx
// Кабинет водителя — лента заявок + возможность принять или предложить свою цену

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  MapPin, Navigation, Star, Users, Luggage, PawPrint,
  CigaretteOff, MessageSquare, ToggleLeft, ToggleRight,
  ChevronRight, Clock, Banknote
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Ride, Profile, DriverVehicle } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'

// ── Компонент карточки заявки ──────────────────────────────────
function RideCard({
  ride,
  myId,
  onOffer,
}: {
  ride: Ride & { passenger?: Profile }
  myId: string
  onOffer: (ride: Ride) => void
}) {
  async function acceptAtPrice() {
    onOffer(ride)
  }

  return (
    <div className="card p-4 animate-slide-up">
      {/* Пассажир */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-semibold text-primary-700">
            {ride.passenger?.full_name?.[0] || '?'}
          </span>
        </div>
        <div>
          <p className="font-medium text-sm text-gray-900">
            {ride.passenger?.full_name || 'Пассажир'}
          </p>
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 text-warning-500" fill="currentColor" />
            <span className="text-xs text-gray-500">
              {Number(ride.passenger?.rating_passenger || 5).toFixed(1)}
            </span>
          </div>
        </div>
        <div className="ml-auto text-right">
          <p className="font-bold text-lg text-gray-900">
            {ride.passenger_price.toLocaleString('ru-RU')} ₽
          </p>
          <p className="text-xs text-gray-400">
            {formatDistanceToNow(new Date(ride.created_at), { addSuffix: true, locale: ru })}
          </p>
        </div>
      </div>

      {/* Маршрут */}
      <div className="bg-gray-50 rounded-xl p-3 mb-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-success-500 rounded-full flex-shrink-0" />
          <p className="text-xs text-gray-600 truncate">{ride.origin_address}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-danger-500 rounded-full flex-shrink-0" />
          <p className="text-xs text-gray-600 truncate">{ride.dest_address}</p>
        </div>
      </div>

      {/* Пожелания пассажира */}
      <div className="flex flex-wrap gap-2 mb-3">
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
          <span className="badge-primary">Межгород</span>
        )}
      </div>

      {/* Комментарий */}
      {ride.comment && (
        <div className="flex gap-2 mb-3 text-xs text-gray-500">
          <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <p>{ride.comment}</p>
        </div>
      )}

      {/* Кнопки */}
      <div className="flex gap-2">
        <button
          onClick={acceptAtPrice}
          className="flex-1 btn-primary btn-sm"
        >
          Принять — {ride.passenger_price.toLocaleString('ru-RU')} ₽
        </button>
        <button
          onClick={() => onOffer(ride)}
          className="btn-secondary btn-sm px-3"
          title="Предложить свою цену"
        >
          <Banknote className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ── Модалка предложения цены ───────────────────────────────────
function OfferModal({
  ride,
  myId,
  onClose,
}: {
  ride: Ride
  myId: string
  onClose: () => void
}) {
  const supabase = createClient()
  const [price, setPrice]     = useState(ride.passenger_price)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  async function send() {
    setSending(true)
    const { error } = await supabase.from('ride_offers').insert({
      ride_id: ride.id,
      driver_id: myId,
      offered_price: price,
      message: message.trim() || null,
      status: 'pending',
    })

    // Обновим статус поездки на "negotiating"
    await supabase.from('rides').update({ status: 'negotiating' }).eq('id', ride.id)

    setSending(false)
    if (error) { toast.error('Ошибка отправки'); return }
    toast.success('Предложение отправлено!')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-modal">
        <h3 className="font-bold text-lg text-gray-900 mb-4">Предложить цену</h3>

        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-1">Цена пассажира</p>
          <p className="font-semibold text-gray-700">{ride.passenger_price.toLocaleString('ru-RU')} ₽</p>
        </div>

        <div className="mb-4">
          <label className="label">Ваша цена (₽)</label>
          <input
            type="number"
            value={price}
            onChange={e => setPrice(Number(e.target.value))}
            className="input text-lg font-semibold"
            min={1}
          />
        </div>

        <div className="mb-5">
          <label className="label">Сообщение (необязательно)</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Расскажите о себе или авто..."
            className="input resize-none"
            rows={2}
          />
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

// ── Главный компонент ──────────────────────────────────────────
export default function DriverPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile]     = useState<Profile | null>(null)
  const [myId, setMyId]           = useState('')
  const [isOnline, setIsOnline]   = useState(false)
  const [rides, setRides]         = useState<Ride[]>([])
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null)
  const [loading, setLoading]     = useState(true)
  const [vehicles, setVehicles]   = useState<DriverVehicle[]>([])

  // Геолокация
  const [geoError, setGeoError]   = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      setMyId(user.id)

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      const { data: vehs } = await supabase.from('driver_vehicles').select('*').eq('driver_id', user.id)
      setVehicles(vehs || [])

      // Проверяем текущий онлайн-статус
      const { data: status } = await supabase.from('driver_status').select('is_online').eq('driver_id', user.id).single()
      setIsOnline(status?.is_online || false)

      // Загружаем ближайшие заявки (status=searching)
      const { data: ridesData } = await supabase
        .from('rides')
        .select('*, passenger:profiles!rides_passenger_id_fkey(*)')
        .eq('status', 'searching')
        .order('created_at', { ascending: false })
        .limit(20)
      setRides(ridesData || [])
      setLoading(false)

      // Realtime — новые заявки
      const channel = supabase.channel('driver-rides')
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'rides',
          filter: `status=eq.searching`,
        }, async ({ new: ride }) => {
          const { data } = await supabase
            .from('rides').select('*, passenger:profiles!rides_passenger_id_fkey(*)')
            .eq('id', ride.id).single()
          if (data) {
            setRides(prev => [data, ...prev])
            toast('📍 Новая заявка поблизости!', { icon: '🚗' })
          }
        })
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'rides',
        }, ({ new: updated }) => {
          // Убираем заявки, которые уже не searching
          if (updated.status !== 'searching') {
            setRides(prev => prev.filter(r => r.id !== updated.id))
          }
        })
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }
    load()
  }, [])

  // ── Переключение онлайн/офлайн ─────────────────────────────
  async function toggleOnline() {
    if (!isOnline) {
      // Включаем — запрашиваем геолокацию
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords
          await supabase.rpc('update_driver_location', {
            p_driver_id: myId,
            p_lat: lat,
            p_lng: lng,
          })
          setIsOnline(true)
          toast.success('Вы онлайн! Заказы будут приходить.')

          // Обновляем геолокацию каждые 30 секунд
          const interval = setInterval(async () => {
            navigator.geolocation.getCurrentPosition(async pos2 => {
              await supabase.rpc('update_driver_location', {
                p_driver_id: myId,
                p_lat: pos2.coords.latitude,
                p_lng: pos2.coords.longitude,
              })
            })
          }, 30000)
          // Сохраняем ID интервала в localStorage для очистки
          localStorage.setItem('geo_interval', String(interval))
        },
        (err) => {
          setGeoError('Разрешите доступ к геолокации')
          toast.error('Нет доступа к геолокации')
        }
      )
    } else {
      // Уходим офлайн
      await supabase.from('driver_status').update({ is_online: false }).eq('driver_id', myId)
      const stored = localStorage.getItem('geo_interval')
      if (stored) clearInterval(Number(stored))
      setIsOnline(false)
      toast('Вы офлайн')
    }
  }

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
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Водитель</h1>
              {profile && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Star className="w-3.5 h-3.5 text-warning-500" fill="currentColor" />
                  <span className="text-xs text-gray-500">
                    {Number(profile.rating_driver).toFixed(1)} · {profile.total_rides_as_driver} рейсов
                  </span>
                </div>
              )}
            </div>
            <Link href="/" className="btn-ghost text-xs px-3 py-2 rounded-xl">← Назад</Link>
          </div>

          {/* Переключатель онлайн */}
          <div className={`mt-3 rounded-xl p-3 flex items-center justify-between ${
            isOnline ? 'bg-success-50' : 'bg-gray-100'
          }`}>
            <div className="flex items-center gap-2">
              {isOnline ? (
                <>
                  <div className="online-dot" />
                  <span className="text-sm font-medium text-success-700">Онлайн — принимаю заказы</span>
                </>
              ) : (
                <span className="text-sm font-medium text-gray-500">Офлайн</span>
              )}
            </div>
            <button
              onClick={toggleOnline}
              className="transition-transform active:scale-90"
            >
              {isOnline ? (
                <ToggleRight className="w-8 h-8 text-success-600" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-gray-400" />
              )}
            </button>
          </div>
          {geoError && <p className="text-xs text-danger-500 mt-1">{geoError}</p>}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {/* Авто не добавлено */}
        {vehicles.length === 0 && (
          <div className="card p-5 border-l-4 border-warning-500">
            <p className="font-semibold text-warning-700 text-sm">Добавьте автомобиль</p>
            <p className="text-xs text-gray-500 mt-1">Без авто вы не сможете принимать заказы</p>
            <Link href="/driver/vehicle" className="btn-primary btn-sm mt-3 inline-flex">
              Добавить авто →
            </Link>
          </div>
        )}

        {/* Быстрые ссылки */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { href: '/driver/earnings', label: 'Заработок', icon: '💰' },
            { href: '/driver/history',  label: 'История',   icon: '🕐' },
            { href: '/driver/vehicle',  label: 'Моё авто',  icon: '🚗' },
          ].map(link => (
            <Link key={link.href} href={link.href}
              className="card p-3 flex flex-col items-center gap-1.5 hover:shadow-card-hover transition-all active:scale-95"
            >
              <span className="text-xl">{link.icon}</span>
              <span className="text-xs text-gray-600 text-center">{link.label}</span>
            </Link>
          ))}
        </div>

        {/* Заявки */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Заявки рядом ({rides.length})
            </h2>
            {!isOnline && (
              <span className="text-xs text-gray-400">Включите онлайн для получения заказов</span>
            )}
          </div>

          {rides.length === 0 ? (
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
                <RideCard
                  key={ride.id}
                  ride={ride as Ride & { passenger?: Profile }}
                  myId={myId}
                  onOffer={setSelectedRide}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Модалка торга */}
      {selectedRide && (
        <OfferModal
          ride={selectedRide}
          myId={myId}
          onClose={() => setSelectedRide(null)}
        />
      )}
    </div>
  )
}
