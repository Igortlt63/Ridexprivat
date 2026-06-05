'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  MapPin, Clock, MessageSquare, ShoppingBag,
  Car, TrendingUp, Briefcase, Star, ChevronRight,
  Navigation, ToggleLeft, ToggleRight, History
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/useAppStore'
import type { Ride } from '@/types'

export default function HomePage() {
  const router   = useRouter()
  const supabase = createClient()
  const { profile, userId, loadProfile, activeRole } = useAppStore()

  const [unread,      setUnread]      = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [activeRides, setActiveRides] = useState<Ride[]>([])

  useEffect(() => {
    async function load() {
      await loadProfile()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      setLoading(false)

      // Активные поездки (пассажир) или принятые (водитель)
      if (activeRole === 'passenger') {
        const { data } = await supabase
          .from('rides')
          .select('id, status, origin_address, dest_address, passenger_price, final_price')
          .eq('passenger_id', user.id)
          .in('status', ['searching', 'negotiating', 'accepted', 'in_progress'])
          .order('created_at', { ascending: false })
          .limit(3)
        setActiveRides((data as Ride[]) || [])
      } else {
        const { data } = await supabase
          .from('rides')
          .select('id, status, origin_address, dest_address, passenger_price, final_price')
          .eq('driver_id', user.id)
          .in('status', ['accepted', 'in_progress'])
          .limit(2)
        setActiveRides((data as Ride[]) || [])
      }

      // Непрочитанные сообщения
      try {
        const { count } = await supabase
          .from('market_messages')
          .select('id', { count: 'exact', head: true })
          .eq('is_read', false)
          .neq('sender_id', user.id)
        setUnread(count || 0)
      } catch { setUnread(0) }
    }
    load()
  }, [activeRole]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !profile) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent mx-auto mb-3" />
        <p className="text-sm text-gray-400 dark:text-slate-500">Загружаем...</p>
      </div>
    </div>
  )

  const firstName   = profile.full_name?.split(' ')[0] || 'Пользователь'
  const isPassenger = activeRole === 'passenger'

  const STATUS_COLORS: Record<string, string> = {
    searching:   'bg-blue-500',
    negotiating: 'bg-amber-500',
    accepted:    'bg-green-500',
    in_progress: 'bg-indigo-500',
  }
  const STATUS_LABELS: Record<string, string> = {
    searching:   'Ищем водителя',
    negotiating: 'Идёт торг',
    accepted:    'Водитель едет',
    in_progress: 'В пути',
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">

      {/* ── Шапка ──────────────────────────────────────────────── */}
      <header className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center">
              <Car className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 dark:text-white text-lg">РидМаркет</span>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/chats" className="btn-ghost p-2 rounded-xl relative" aria-label="Сообщения">
              <MessageSquare className="w-5 h-5" />
              {unread > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
            <Link href="/profile" className="btn-ghost p-2 rounded-xl" aria-label="Профиль">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} className="w-7 h-7 rounded-lg object-cover" alt="" />
              ) : (
                <div className="w-7 h-7 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-300">
                    {profile.full_name?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pb-8">

        {/* ── Герой ────────────────────────────────────────────── */}
        <div className={`mx-0 mt-4 mb-5 rounded-3xl p-6 text-white relative overflow-hidden ${
          isPassenger
            ? 'bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700'
            : 'bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700'
        }`}>
          {/* Декоративные круги */}
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-12 -left-6 w-48 h-48 rounded-full bg-white/10" />

          <div className="relative">
            <p className="text-sm font-medium text-white/70 mb-1">
              {isPassenger ? '👤 Режим пассажира' : '🚗 Режим водителя'}
            </p>
            <h1 className="text-2xl font-bold mb-1">Привет, {firstName}!</h1>
            <div className="flex items-center gap-1.5 mb-5">
              <Star className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
              <span className="text-sm text-white/80">
                {isPassenger
                  ? `${Number(profile.rating_passenger).toFixed(1)} · ${profile.total_rides_as_passenger} поездок`
                  : `${Number(profile.rating_driver).toFixed(1)} · ${profile.total_rides_as_driver} рейсов`
                }
              </span>
            </div>

            {isPassenger ? (
              <Link href="/passenger/new-ride"
                className="inline-flex items-center gap-2 bg-white text-indigo-700 font-bold px-5 py-3 rounded-2xl text-sm hover:bg-indigo-50 active:scale-95 transition-all shadow-lg"
              >
                <Navigation className="w-4 h-4" />
                Создать заявку
              </Link>
            ) : (
              <Link href="/driver"
                className="inline-flex items-center gap-2 bg-white text-emerald-700 font-bold px-5 py-3 rounded-2xl text-sm hover:bg-emerald-50 active:scale-95 transition-all shadow-lg"
              >
                <Briefcase className="w-4 h-4" />
                Принять заказы
              </Link>
            )}
          </div>
        </div>

        {/* ── Активные поездки ─────────────────────────────────── */}
        {activeRides.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-2.5">
              {isPassenger ? 'Активные заявки' : 'Текущие поездки'}
            </p>
            <div className="space-y-2">
              {activeRides.map(ride => (
                <Link
                  key={ride.id}
                  href={isPassenger ? `/passenger/ride/${ride.id}` : `/driver/ride/${ride.id}`}
                  className="card p-4 flex items-center gap-3 hover:shadow-md transition-all active:scale-95"
                >
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_COLORS[ride.status] || 'bg-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
                      {STATUS_LABELS[ride.status]}
                    </p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {ride.origin_address} → {ride.dest_address}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {(ride.final_price || ride.passenger_price).toLocaleString('ru-RU')} ₽
                    </p>
                    <ChevronRight className="w-4 h-4 text-gray-300 dark:text-slate-600 ml-auto mt-0.5" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Быстрые действия (зависят от роли) ──────────────── */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-2.5">
            Быстрые действия
          </p>
          <div className="grid grid-cols-2 gap-3">
            {isPassenger ? (
              <>
                <QuickLink href="/passenger/new-ride" icon={MapPin}        label="Новая заявка"      color="text-indigo-600 dark:text-indigo-400" bg="bg-indigo-50 dark:bg-indigo-900/30" />
                <QuickLink href="/passenger/history"  icon={History}       label="История поездок"   color="text-green-600 dark:text-green-400"   bg="bg-green-50 dark:bg-green-900/30" />
                <QuickLink href="/passenger/routes"   icon={Navigation}    label="Мои маршруты"      color="text-violet-600 dark:text-violet-400" bg="bg-violet-50 dark:bg-violet-900/30" />
                <QuickLink href="/chats"              icon={MessageSquare} label="Сообщения"          color="text-blue-600 dark:text-blue-400"     bg="bg-blue-50 dark:bg-blue-900/30" unread={unread} />
              </>
            ) : (
              <>
                <QuickLink href="/driver"          icon={Car}          label="Принять заказ"   color="text-emerald-600 dark:text-emerald-400" bg="bg-emerald-50 dark:bg-emerald-900/30" />
                <QuickLink href="/driver/earnings" icon={TrendingUp}   label="Заработок"       color="text-amber-600 dark:text-amber-400"    bg="bg-amber-50 dark:bg-amber-900/30" />
                <QuickLink href="/driver/history"  icon={History}      label="История рейсов"  color="text-green-600 dark:text-green-400"    bg="bg-green-50 dark:bg-green-900/30" />
                <QuickLink href="/chats"           icon={MessageSquare} label="Сообщения"      color="text-blue-600 dark:text-blue-400"      bg="bg-blue-50 dark:bg-blue-900/30" unread={unread} />
              </>
            )}
          </div>
        </div>

        {/* ── Маркет (общий для обеих ролей) ───────────────────── */}
        <Link href="/market"
          className="card p-4 flex items-center gap-4 hover:shadow-md transition-all active:scale-95"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900 dark:text-white">Маркет</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">Авто · Услуги · Недвижимость · и ещё 8 категорий</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300 dark:text-slate-600" />
        </Link>

      </main>
    </div>
  )
}

// ── Компонент быстрой ссылки ──────────────────────────────────
function QuickLink({
  href, icon: Icon, label, color, bg, unread
}: {
  href: string
  icon: React.ElementType
  label: string
  color: string
  bg: string
  unread?: number
}) {
  return (
    <Link href={href}
      className="card p-3.5 flex items-center gap-3 hover:shadow-md transition-all active:scale-95 relative"
    >
      <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <span className="text-sm font-medium text-gray-700 dark:text-slate-200">{label}</span>
      {unread && unread > 0 ? (
        <span className="absolute top-2 right-2 min-w-[18px] h-[18px] bg-rose-500 rounded-full text-white text-xs flex items-center justify-center font-bold px-1">
          {unread > 9 ? '9+' : unread}
        </span>
      ) : null}
    </Link>
  )
}
