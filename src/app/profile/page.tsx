'use client'

// src/app/profile/page.tsx — Профиль и настройки

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { ChevronLeft, Camera, Star, Shield, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile]   = useState<Profile | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string>('')

  const { register, handleSubmit, reset } = useForm<{ full_name: string }>()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data)
      reset({ full_name: data?.full_name || '' })
      if (data?.avatar_url) setAvatarPreview(data.avatar_url)
      setLoading(false)
    }
    load()
  }, [])

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function onSave(data: { full_name: string }) {
    if (!profile) return
    setSaving(true)
    let avatarUrl = profile.avatar_url

    if (avatarFile) {
      const ext  = avatarFile.name.split('.').pop()
      const path = `avatars/${profile.id}.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true })
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
        avatarUrl = publicUrl
      }
    }

    const { error } = await supabase.from('profiles').update({
      full_name: data.full_name.trim(),
      avatar_url: avatarUrl,
    }).eq('id', profile.id)

    setSaving(false)
    if (error) toast.error('Ошибка сохранения')
    else toast.success('Профиль обновлён!')
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="btn-ghost p-2 rounded-xl">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">Мой профиль</h1>
        </div>
      </header>

      <form onSubmit={handleSubmit(onSave)} className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Аватар */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            {avatarPreview ? (
              <img src={avatarPreview} alt="avatar" className="w-24 h-24 rounded-2xl object-cover" />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-primary-100 flex items-center justify-center">
                <span className="text-3xl font-bold text-primary-600">
                  {profile?.full_name?.[0] || '?'}
                </span>
              </div>
            )}
            <label className="absolute -bottom-1.5 -right-1.5 w-8 h-8 bg-primary-600 rounded-xl flex items-center justify-center cursor-pointer shadow-lg">
              <Camera className="w-4 h-4 text-white" />
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </label>
          </div>
          <p className="text-sm text-gray-500">{profile?.phone}</p>
        </div>

        {/* Имя */}
        <div className="card p-4">
          <label className="label">Имя и фамилия</label>
          <input
            {...register('full_name')}
            placeholder="Иван Иванов"
            className="input"
          />
        </div>

        {/* Рейтинги */}
        <div className="card p-4">
          <p className="font-semibold text-gray-900 mb-3">Мои рейтинги</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Как пассажир', value: profile?.rating_passenger, count: profile?.total_rides_as_passenger },
              { label: 'Как водитель', value: profile?.rating_driver,    count: profile?.total_rides_as_driver },
            ].map(item => (
              <div key={item.label} className="bg-gray-50 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Star className="w-4 h-4 text-warning-500" fill="currentColor" />
                  <span className="text-xl font-bold">{Number(item.value).toFixed(1)}</span>
                </div>
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="text-xs text-gray-400">{item.count} поездок</p>
              </div>
            ))}
          </div>
        </div>

        {/* Верификация */}
        <div className="card p-4 flex items-center gap-3">
          <Shield className={`w-6 h-6 ${profile?.is_verified ? 'text-success-600' : 'text-gray-300'}`} />
          <div>
            <p className="font-medium text-sm text-gray-900">
              {profile?.is_verified ? 'Аккаунт верифицирован' : 'Аккаунт не верифицирован'}
            </p>
            <p className="text-xs text-gray-500">
              {profile?.is_verified ? 'Телефон подтверждён' : 'Пройдите верификацию для доверия'}
            </p>
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary btn-lg w-full">
          {saving ? 'Сохраняем...' : 'Сохранить изменения'}
        </button>

        <button type="button" onClick={logout} className="w-full btn-secondary text-danger-500 py-3 flex items-center justify-center gap-2">
          <LogOut className="w-4 h-4" />
          Выйти из аккаунта
        </button>
      </form>
    </div>
  )
}
