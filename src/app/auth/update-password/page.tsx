'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Lock, Eye, EyeOff, Car } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword]   = useState('')
  const [password2, setPassword2] = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [ready, setReady]         = useState(false)

  useEffect(() => {
    // Supabase автоматически обрабатывает токен из URL
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
  }, [])

  async function handleUpdate() {
    if (!password || !password2) { toast.error('Заполните все поля'); return }
    if (password.length < 6)     { toast.error('Пароль минимум 6 символов'); return }
    if (password !== password2)  { toast.error('Пароли не совпадают'); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) { toast.error('Ошибка: ' + error.message); return }

    toast.success('Пароль успешно обновлён!')
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur mb-4">
            <Car className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">РидМаркет</h1>
          <p className="text-indigo-200 mt-1 text-sm">Новый пароль</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8 space-y-4">
          <div className="mb-2">
            <h2 className="text-xl font-bold text-gray-900">Придумайте новый пароль</h2>
            <p className="text-sm text-gray-500 mt-1">Минимум 6 символов</p>
          </div>

          <div>
            <label className="label">Новый пароль</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Минимум 6 символов"
                className="input pl-10 pr-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="label">Повторите пароль</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showPass ? 'text' : 'password'}
                value={password2}
                onChange={e => setPassword2(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleUpdate()}
                placeholder="Повторите пароль"
                className="input pl-10"
              />
            </div>
          </div>

          <button
            onClick={handleUpdate}
            disabled={loading}
            className="btn-primary btn-lg w-full mt-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Сохраняем...
              </span>
            ) : 'Сохранить пароль'}
          </button>

          <button
            onClick={() => router.push('/auth')}
            className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors text-center"
          >
            ← Вернуться ко входу
          </button>
        </div>
      </div>
    </div>
  )
}
