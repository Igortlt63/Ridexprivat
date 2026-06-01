'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { User, Car, Star, ShoppingBag, MessageSquare, ChevronRight, MapPin, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

export default function HomePage() {
  const router   = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [unread,  setUnread]  = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      // Загружаем профиль — это критично
      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)
      setLoading(false) // показываем страницу сразу после профиля

      // Счётчик непрочитанных — в фоне, не блокируем рендер
      try {
        const { count } = await supabase
          .from('market_messages')
          .select('id', { count: 'exact', head: true })
          .eq('is_read', false)
          .neq('sender_id', user.id)
        setUnread(count || 0)
      } catch {
        // Таблица может не существовать — просто игнорируем
        setUnread(0)
      }
    }
    load()
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent mx-auto mb-3" />
        <p className="text-sm text-gray-400">Загружаем...</p>
      </div>
    </div>
  )

  const firstName = profile?.full_name?.split(' ')[0] || 'Пользователь'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Шапка */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center">
              <Car className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">РидМаркет</span>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/chats" className="btn-ghost p-2 rounded-xl relative">
              <MessageSquare className="w-5 h-5" />
              {unread > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
            <Link href="/profile" className="btn-ghost p-2 rounded-xl">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} className="w-6 h-6 rounded-lg object-cover" alt="" />
              ) : (
                <div className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <span className="text-xs font-bold text-indigo-600">
                    {profile?.full_name?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Приветствие */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Привет, {firstName}! 👋</h1>
          <p className="text-gray-500 mt-0.5 text-sm">Куда едем сегодня?</p>
        </div>

        {/* Кабинеты */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/passenger"
            className="card p-5 flex flex-col items-center gap-3 hover:shadow-md transition-all active:scale-95 group"
          >
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
              <User className="w-7 h-7 text-indigo-600" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-900">Пассажир</p>
              <p className="text-xs text-gray-400 mt-0.5">Найти поездку</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span>{Number(profile?.rating_passenger || 5).toFixed(1)}</span>
              <span>· {profile?.total_rides_as_passenger || 0} поездок</span>
            </div>
          </Link>

          <Link href="/driver"
            className="card p-5 flex flex-col items-center gap-3 hover:shadow-md transition-all active:scale-95 group"
          >
            <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center group-hover:bg-green-100 transition-colors">
              <Car className="w-7 h-7 text-green-600" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-900">Водитель</p>
              <p className="text-xs text-gray-400 mt-0.5">Принять заказ</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span>{Number(profile?.rating_driver || 5).toFixed(1)}</span>
              <span>· {profile?.total_rides_as_driver || 0} рейсов</span>
            </div>
          </Link>
        </div>

        {/* Маркет */}
        <Link href="/market"
          className="card p-4 flex items-center gap-4 hover:shadow-md transition-all active:scale-95"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">Маркет</p>
            <p className="text-xs text-gray-500">Авто · Услуги · Недвижимость · и ещё 8 категорий</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300" />
        </Link>

        {/* Быстрые действия */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Быстрые действия</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: '/passenger/new-ride', icon: MapPin,        label: 'Создать заявку',  color: 'text-indigo-500', bg: 'bg-indigo-50' },
              { href: '/passenger/history',  icon: Clock,         label: 'История поездок', color: 'text-green-600',  bg: 'bg-green-50' },
              { href: '/chats',              icon: MessageSquare, label: 'Сообщения',        color: 'text-blue-500',   bg: 'bg-blue-50' },
              { href: '/profile',            icon: User,          label: 'Мой профиль',     color: 'text-gray-500',   bg: 'bg-gray-100' },
            ].map(item => (
              <Link key={item.href} href={item.href}
                className="card p-3.5 flex items-center gap-3 hover:shadow-md transition-all active:scale-95"
              >
                <div className={`w-9 h-9 ${item.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <item.icon className={`w-4.5 h-4.5 ${item.color}`} />
                </div>
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
