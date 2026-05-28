'use client'

// src/app/page.tsx
// Главная страница — выбор роли: пассажир или водитель

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { User, Car, Star, MapPin, ShoppingBag, Bell, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

export default function HomePage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile]     = useState<Profile | null>(null)
  const [loading, setLoading]     = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile(data)
      setLoading(false)
    }
    loadProfile()
  }, [])

  async function handleLogout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.push('/auth')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  const displayName = profile?.full_name || 'Пользователь'

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white">
      {/* Шапка */}
      <header className="sticky top-0 z-10 glass border-b border-gray-100 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="w-6 h-6 text-primary-600" />
            <span className="font-bold text-gray-900">РидМаркет</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-ghost p-2 rounded-xl relative">
              <Bell className="w-5 h-5" />
              {/* Красная точка непрочитанных уведомлений */}
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger-500 rounded-full" />
            </button>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="btn-ghost p-2 rounded-xl"
              title="Выйти"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        {/* Приветствие */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Привет, {displayName.split(' ')[0]}! 👋
          </h1>
          <p className="text-gray-500 mt-1">Как ты сегодня путешествуешь?</p>
        </div>

        {/* Выбор роли */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {/* Пассажир */}
          <Link
            href="/passenger"
            className="card p-6 flex flex-col items-center gap-3 hover:shadow-card-hover transition-all duration-200 active:scale-95 group"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center group-hover:bg-primary-100 transition-colors">
              <User className="w-8 h-8 text-primary-600" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-900">Пассажир</p>
              <p className="text-xs text-gray-500 mt-0.5">Найти поездку</p>
            </div>
            {profile && (
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Star className="w-3 h-3 text-warning-500" fill="currentColor" />
                <span>{Number(profile.rating_passenger).toFixed(1)}</span>
              </div>
            )}
          </Link>

          {/* Водитель */}
          <Link
            href="/driver"
            className="card p-6 flex flex-col items-center gap-3 hover:shadow-card-hover transition-all duration-200 active:scale-95 group"
          >
            <div className="w-16 h-16 rounded-2xl bg-success-50 flex items-center justify-center group-hover:bg-green-100 transition-colors">
              <Car className="w-8 h-8 text-success-700" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-900">Водитель</p>
              <p className="text-xs text-gray-500 mt-0.5">Принять заказ</p>
            </div>
            {profile && (
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Star className="w-3 h-3 text-warning-500" fill="currentColor" />
                <span>{Number(profile.rating_driver).toFixed(1)}</span>
              </div>
            )}
          </Link>
        </div>

        {/* Маркет */}
        <Link
          href="/market"
          className="card p-5 flex items-center gap-4 hover:shadow-card-hover transition-all duration-200 active:scale-95 mb-4"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">Маркет</p>
            <p className="text-xs text-gray-500">Товары и услуги • Авто • Недвижимость</p>
          </div>
          <span className="text-gray-400">→</span>
        </Link>

        {/* Статистика профиля */}
        {profile && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Мой профиль</h3>
              <Link href="/profile" className="text-xs text-primary-600 hover:underline">
                Редактировать
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xl font-bold text-gray-900">
                  {profile.total_rides_as_passenger}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Поездок</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xl font-bold text-gray-900">
                  {profile.total_rides_as_driver}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Рейсов</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center justify-center gap-1">
                  <Star className="w-4 h-4 text-warning-500" fill="currentColor" />
                  <p className="text-xl font-bold text-gray-900">
                    {Number(profile.rating_passenger).toFixed(1)}
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">Рейтинг</p>
              </div>
            </div>
          </div>
        )}

        {/* Быстрые ссылки */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link
            href="/passenger/history"
            className="card p-4 flex items-center gap-3 hover:shadow-card-hover transition-all active:scale-95"
          >
            <MapPin className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-700">История поездок</span>
          </Link>
          <Link
            href="/profile/settings"
            className="card p-4 flex items-center gap-3 hover:shadow-card-hover transition-all active:scale-95"
          >
            <User className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-700">Настройки</span>
          </Link>
        </div>
      </main>
    </div>
  )
}
