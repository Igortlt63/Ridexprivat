'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  ChevronLeft, Camera, Star, Shield, LogOut, Phone, Mail,
  Car, FileText, ChevronRight, Edit3, Check, X
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, DriverVehicle } from '@/types'

// ── Инлайн-редактор поля ──────────────────────────────────────
function EditableField({
  label, value, onSave, type = 'text', placeholder
}: {
  label: string
  value: string
  onSave: (v: string) => Promise<void>
  type?: string
  placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState(value)
  const [saving, setSaving]   = useState(false)

  async function save() {
    if (val.trim() === value) { setEditing(false); return }
    setSaving(true)
    await onSave(val.trim())
    setSaving(false)
    setEditing(false)
  }

  function cancel() { setVal(value); setEditing(false) }

  return (
    <div className="py-3 border-b border-gray-50 last:border-0">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            type={type}
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
            placeholder={placeholder}
            className="input py-1.5 text-sm flex-1"
            autoFocus
          />
          <button onClick={save} disabled={saving} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg">
            <Check className="w-4 h-4" />
          </button>
          <button onClick={cancel} className="p-1.5 text-gray-400 hover:bg-gray-50 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-900">{value || <span className="text-gray-400">{placeholder || 'Не указано'}</span>}</p>
          <button onClick={() => setEditing(true)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Звёзды рейтинга ───────────────────────────────────────────
function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= Math.round(value) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
      ))}
      <span className="ml-1 text-sm font-semibold text-gray-700">{Number(value).toFixed(1)}</span>
    </div>
  )
}

export default function ProfilePage() {
  const router   = useRouter()
  const supabase = createClient()

  const [profile,  setProfile]  = useState<Profile | null>(null)
  const [vehicles, setVehicles] = useState<DriverVehicle[]>([])
  const [loading,  setLoading]  = useState(true)
  const [myId,     setMyId]     = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      setMyId(user.id)

      const [{ data: prof }, { data: vehs }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('driver_vehicles').select('*').eq('driver_id', user.id).eq('is_active', true),
      ])
      setProfile(prof)
      setVehicles(vehs || [])
      setLoading(false)
    }
    load()
  }, [])

  // ── Обновление поля профиля ───────────────────────────────────
  async function updateField(field: string, value: string) {
    const { error } = await supabase.from('profiles').update({ [field]: value }).eq('id', myId)
    if (error) { toast.error('Ошибка сохранения'); return }
    setProfile(prev => prev ? { ...prev, [field]: value } : prev)
    toast.success('Сохранено')
  }

  // ── Загрузка аватара ──────────────────────────────────────────
  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const ext  = file.name.split('.').pop()
    const path = `avatars/${myId}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) { toast.error('Ошибка загрузки фото'); return }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    await updateField('avatar_url', publicUrl)
    toast.success('Фото обновлено!')
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Шапка */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="btn-ghost p-2 rounded-xl">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">Профиль</h1>
          </div>
          <button onClick={logout} className="btn-ghost p-2 rounded-xl text-rose-500" title="Выйти">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* Аватар + имя */}
        <div className="card p-5">
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar"
                  className="w-20 h-20 rounded-2xl object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-indigo-100 flex items-center justify-center">
                  <span className="text-3xl font-bold text-indigo-600">
                    {profile?.full_name?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg hover:bg-indigo-700 transition-colors"
              >
                <Camera className="w-3.5 h-3.5 text-white" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
            </div>

            <div className="flex-1">
              <p className="font-bold text-lg text-gray-900">{profile?.full_name || 'Имя не указано'}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {profile?.is_verified ? (
                  <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                    <Shield className="w-3 h-3" /> Верифицирован
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">Не верифицирован</span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                На сервисе с {new Date(profile?.created_at || '').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* Рейтинги */}
        <div className="card p-4">
          <p className="font-semibold text-gray-900 mb-3">Рейтинги</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1.5">Как пассажир</p>
              <Stars value={profile?.rating_passenger || 5} />
              <p className="text-xs text-gray-400 mt-1">{profile?.total_rides_as_passenger} поездок</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1.5">Как водитель</p>
              <Stars value={profile?.rating_driver || 5} />
              <p className="text-xs text-gray-400 mt-1">{profile?.total_rides_as_driver} рейсов</p>
            </div>
          </div>
        </div>

        {/* Личные данные */}
        <div className="card p-4">
          <p className="font-semibold text-gray-900 mb-2">Личные данные</p>
          <EditableField
            label="Имя и фамилия"
            value={profile?.full_name || ''}
            onSave={v => updateField('full_name', v)}
            placeholder="Иван Иванов"
          />
          <EditableField
            label="Номер телефона"
            value={profile?.phone || ''}
            onSave={v => updateField('phone', v)}
            type="tel"
            placeholder="+7 (900) 000-00-00"
          />
        </div>

        {/* Мои автомобили */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-gray-900">Мои автомобили</p>
            <Link href="/profile/vehicle/new" className="text-xs text-indigo-600 font-medium hover:underline">
              + Добавить
            </Link>
          </div>

          {vehicles.length === 0 ? (
            <div className="text-center py-5">
              <Car className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Автомобили не добавлены</p>
              <Link href="/profile/vehicle/new" className="btn-primary btn-sm mt-3 inline-flex">
                Добавить авто
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {vehicles.map(v => (
                <Link key={v.id} href={`/profile/vehicle/${v.id}`}
                  className="flex items-center gap-3 py-2.5 px-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <Car className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{v.brand} {v.model} {v.year}</p>
                    <p className="text-xs text-gray-400">{v.color} · {v.plate_number} · {v.seats_count} мест</p>
                  </div>
                  {v.is_verified && <Shield className="w-4 h-4 text-green-500 flex-shrink-0" />}
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Быстрые ссылки */}
        <div className="card divide-y divide-gray-50">
          {[
            { href: '/passenger/history', icon: Car,      label: 'История поездок' },
            { href: '/market/my',         icon: FileText, label: 'Мои объявления' },
            { href: '/profile/reviews',   icon: Star,     label: 'Мои отзывы' },
          ].map(item => (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
            >
              <item.icon className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700 flex-1">{item.label}</span>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </Link>
          ))}
        </div>

        {/* Выход */}
        <button
          onClick={logout}
          className="w-full btn-secondary text-rose-500 py-3.5 flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Выйти из аккаунта
        </button>

        <div className="h-4" />
      </div>
    </div>
  )
}
