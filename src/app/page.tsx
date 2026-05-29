'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { User, Car, Star, ShoppingBag, Bell, MessageSquare, ChevronRight, MapPin, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

export default function HomePage() {
  const router   = useRouter()
  const supabase = createClient()
  const [profile, setProfile]   = useState<Profile | null>(null)
  const [unread,  setUnread]    = useState(0)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      // Считаем непрочитанные сообщения
      const { count } = await supabase
        .from('market_messages')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false)
        .neq('sender_id', user.id)
      setUnread(count || 0)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
    </div>
  )

  const firstName = profile?.full_name?.split(' ')[0] || 'Пользователь'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Шапка */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="w-6 h-6 text-indigo-600" />
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
                <User className="w-5 h-5" />
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
              <span>· {profile?.total_rides_as_passenger} поездок</span>
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
              <span>· {profile?.total_rides_as_driver} рейсов</span>
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
              { href: '/passenger/new-ride', icon: MapPin,       label: 'Создать заявку',  color: 'text-indigo-400' },
              { href: '/passenger/history',  icon: Clock,        label: 'История поездок', color: 'text-green-500' },
              { href: '/chats',              icon: MessageSquare, label: 'Сообщения',      color: 'text-blue-400' },
              { href: '/profile',            icon: User,         label: 'Мой профиль',     color: 'text-gray-400' },
            ].map(item => (
              <Link key={item.href} href={item.href}
                className="card p-3.5 flex items-center gap-3 hover:shadow-md transition-all active:scale-95"
              >
                <item.icon className={`w-5 h-5 ${item.color} flex-shrink-0`} />
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
