'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Lock, Eye, EyeOff, Car, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [password,  setPassword]  = useState('')
  const [password2, setPassword2] = useState('')
  const [showPass,  setShowPass]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [ready,     setReady]     = useState(false)   // токен обработан
  const [invalid,   setInvalid]   = useState(false)   // токен недействителен

  useEffect(() => {
    // Supabase читает токен из хэша URL и устанавливает сессию
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })

    // Если через 5 секунд событие не пришло — токен недействителен
    const timer = setTimeout(() => {
      setReady(prev => {
        if (!prev) setInvalid(true)
        return prev
      })
    }, 5000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  async function handleUpdate() {
    if (!password || !password2) { toast.error('Заполните все поля'); return }
    if (password.length < 6)     { toast.error('Пароль минимум 6 символов'); return }
    if (password !== password2)  { toast.error('Пароли не совпадают'); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      toast.error('Ошибка: ' + error.message)
      return
    }

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
          <p className="text-indigo-200 mt-1 text-sm">Восстановление пароля</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">

          {/* Загрузка — ждём обработки токена */}
          {!ready && !invalid && (
            <div className="text-center py-6">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent mx-auto mb-4" />
              <p className="text-gray-500 text-sm">Проверяем ссылку...</p>
            </div>
          )}

          {/* Недействительная ссылка */}
          {invalid && (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7 text-rose-500" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Ссылка недействительна</h2>
              <p className="text-gray-500 text-sm mb-6">
                Ссылка устарела или уже была использована. Запросите сброс пароля снова.
              </p>
              <button
                onClick={() => router.push('/auth')}
                className="btn-primary w-full"
              >
                Вернуться ко входу
              </button>
            </div>
          )}

          {/* Форма нового пароля */}
          {ready && !invalid && (
            <div className="space-y-4">
              <div className="pb-4 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900">Новый пароль</h2>
                <p className="text-sm text-gray-500 mt-1">Придумайте надёжный пароль</p>
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
                    onKeyDown={e => { if (e.key === 'Enter') handleUpdate() }}
                    placeholder="Повторите пароль"
                    className="input pl-10"
                  />
                </div>
                {password2.length > 0 && (
                  <p className={`text-xs mt-1 ${password === password2 ? 'text-green-600' : 'text-rose-500'}`}>
                    {password === password2 ? '✓ Пароли совпадают' : '✗ Пароли не совпадают'}
                  </p>
                )}
              </div>

              <button
                onClick={handleUpdate}
                disabled={loading}
                className="btn-primary btn-lg w-full"
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
          )}

        </div>
      </div>
    </div>
  )
}
