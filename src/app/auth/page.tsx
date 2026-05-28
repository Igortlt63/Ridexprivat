'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Mail, Lock, Eye, EyeOff, Car, UserPlus, LogIn } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Mode = 'login' | 'register' | 'reset'

export default function AuthPage() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode]           = useState<Mode>('login')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [password2, setPassword2] = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [loading, setLoading]     = useState(false)

  // ── Вход ────────────────────────────────────────────────────
  async function handleLogin() {
    if (!email || !password) { toast.error('Заполните все поля'); return }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      if (error.message.includes('Invalid login')) toast.error('Неверный email или пароль')
      else toast.error('Ошибка входа: ' + error.message)
      return
    }
    toast.success('Добро пожаловать!')
    router.push('/')
    router.refresh()
  }

  // ── Регистрация ─────────────────────────────────────────────
  async function handleRegister() {
    if (!email || !password || !password2) { toast.error('Заполните все поля'); return }
    if (password.length < 6) { toast.error('Пароль минимум 6 символов'); return }
    if (password !== password2) { toast.error('Пароли не совпадают'); return }
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` }
    })
    setLoading(false)
    if (error) { toast.error('Ошибка: ' + error.message); return }
    toast.success('Аккаунт создан! Проверьте почту для подтверждения.')
    setMode('login')
  }

  // ── Сброс пароля ────────────────────────────────────────────
  async function handleReset() {
    if (!email) { toast.error('Введите email'); return }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`
    })
    setLoading(false)
    if (error) { toast.error('Ошибка: ' + error.message); return }
    toast.success('Ссылка для сброса пароля отправлена на почту')
    setMode('login')
  }

  function handleSubmit() {
    if (mode === 'login')    handleLogin()
    if (mode === 'register') handleRegister()
    if (mode === 'reset')    handleReset()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Лого */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur mb-4 shadow-lg">
            <Car className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">РидМаркет</h1>
          <p className="text-indigo-200 mt-1 text-sm">Поездки с договорной ценой</p>
        </div>

        {/* Карточка */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

          {/* Вкладки Войти / Регистрация */}
          {mode !== 'reset' && (
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setMode('login')}
                className={`flex-1 py-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                  mode === 'login'
                    ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <LogIn className="w-4 h-4" /> Войти
              </button>
              <button
                onClick={() => setMode('register')}
                className={`flex-1 py-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                  mode === 'register'
                    ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <UserPlus className="w-4 h-4" /> Регистрация
              </button>
            </div>
          )}

          <div className="p-8 space-y-4">

            {/* Заголовок для сброса пароля */}
            {mode === 'reset' && (
              <div className="mb-2">
                <h2 className="text-xl font-bold text-gray-900">Сброс пароля</h2>
                <p className="text-sm text-gray-500 mt-1">Отправим ссылку для восстановления</p>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder="example@mail.ru"
                  className="input pl-10"
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            {/* Пароль */}
            {mode !== 'reset' && (
              <div>
                <label className="label">Пароль</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && mode === 'login' && handleSubmit()}
                    placeholder={mode === 'register' ? 'Минимум 6 символов' : '••••••••'}
                    className="input pl-10 pr-10"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
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
            )}

            {/* Подтверждение пароля — только при регистрации */}
            {mode === 'register' && (
              <div>
                <label className="label">Повторите пароль</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password2}
                    onChange={e => setPassword2(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    placeholder="Повторите пароль"
                    className="input pl-10"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            )}

            {/* Забыл пароль — только при входе */}
            {mode === 'login' && (
              <div className="flex justify-end">
                <button
                  onClick={() => { setMode('reset'); setPassword('') }}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Забыли пароль?
                </button>
              </div>
            )}

            {/* Кнопка действия */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn-primary btn-lg w-full mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  {mode === 'login' ? 'Входим...' : mode === 'register' ? 'Создаём...' : 'Отправляем...'}
                </span>
              ) : (
                mode === 'login' ? 'Войти'
                : mode === 'register' ? 'Создать аккаунт'
                : 'Отправить ссылку'
              )}
            </button>

            {/* Назад при сбросе пароля */}
            {mode === 'reset' && (
              <button
                onClick={() => setMode('login')}
                className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors text-center"
              >
                ← Вернуться ко входу
              </button>
            )}

          </div>
        </div>

        <p className="text-center text-indigo-300 text-xs mt-6">
          Нажимая «Создать аккаунт», вы соглашаетесь с правилами сервиса
        </p>
      </div>
    </div>
  )
}