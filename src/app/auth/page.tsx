'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Mail, Lock, Eye, EyeOff, Car, UserPlus, LogIn, User, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Mode = 'login' | 'register' | 'reset' | 'check_email'

export default function AuthPage() {
  const router  = useRouter()
  const supabase = createClient()

  const [mode,      setMode]      = useState<Mode>('login')
  const [email,     setEmail]     = useState('')
  const [fullName,  setFullName]  = useState('')
  const [password,  setPassword]  = useState('')
  const [password2, setPassword2] = useState('')
  const [showPass,  setShowPass]  = useState(false)
  const [loading,   setLoading]   = useState(false)

  // Очищаем поля при смене режима
  function switchMode(m: Mode) {
    setMode(m)
    setPassword('')
    setPassword2('')
    setShowPass(false)
  }

  // ── Вход ──────────────────────────────────────────────────────
  async function handleLogin() {
    if (!email.trim() || !password) {
      toast.error('Заполните все поля')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    setLoading(false)

    if (error) {
      if (
        error.message.includes('Invalid login') ||
        error.message.includes('invalid_credentials') ||
        error.message.includes('Email not confirmed')
      ) {
        toast.error('Неверный email или пароль')
      } else {
        toast.error('Ошибка входа: ' + error.message)
      }
      return
    }

    toast.success('Добро пожаловать!')
    router.push('/')
    router.refresh()
  }

  // ── Регистрация ───────────────────────────────────────────────
  async function handleRegister() {
    if (!email.trim() || !fullName.trim() || !password || !password2) {
      toast.error('Заполните все поля')
      return
    }
    if (fullName.trim().length < 2) {
      toast.error('Введите имя (минимум 2 символа)')
      return
    }
    if (password.length < 6) {
      toast.error('Пароль минимум 6 символов')
      return
    }
    if (password !== password2) {
      toast.error('Пароли не совпадают')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email:    email.trim().toLowerCase(),
      password,
      options: {
        data:            { full_name: fullName.trim() },
        emailRedirectTo: `${window.location.origin}/auth/confirmed`,
      },
    })
    setLoading(false)

    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('Этот email уже зарегистрирован. Войдите или сбросьте пароль.')
      } else {
        toast.error('Ошибка регистрации: ' + error.message)
      }
      return
    }

    // Показываем экран "проверьте почту"
    setMode('check_email')
  }

  // ── Сброс пароля ──────────────────────────────────────────────
  async function handleReset() {
    if (!email.trim()) {
      toast.error('Введите email')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/auth/update-password` }
    )
    setLoading(false)

    if (error) {
      toast.error('Ошибка: ' + error.message)
      return
    }

    toast.success('Ссылка для сброса пароля отправлена!')
    setMode('check_email')
  }

  // ── Экран "проверьте почту" ───────────────────────────────────
  if (mode === 'check_email') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur mb-4">
              <Car className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">РидМаркет</h1>
          </div>
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Проверьте почту</h2>
            <p className="text-gray-500 text-sm mb-1">
              Отправили письмо на
            </p>
            <p className="font-semibold text-gray-800 mb-4">{email}</p>
            <p className="text-gray-400 text-xs mb-6">
              Перейдите по ссылке в письме чтобы продолжить. Если письмо не пришло — проверьте папку «Спам».
            </p>
            <button
              onClick={() => switchMode('login')}
              className="btn-primary w-full"
            >
              Вернуться ко входу
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Основной рендер ───────────────────────────────────────────
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

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

          {/* Вкладки — только для login и register */}
          {(mode === 'login' || mode === 'register') && (
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => switchMode('login')}
                className={`flex-1 py-4 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                  mode === 'login'
                    ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/40'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
              >
                <LogIn className="w-4 h-4" /> Войти
              </button>
              <button
                onClick={() => switchMode('register')}
                className={`flex-1 py-4 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                  mode === 'register'
                    ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/40'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
              >
                <UserPlus className="w-4 h-4" /> Регистрация
              </button>
            </div>
          )}

          <div className="p-8 space-y-4">

            {/* Заголовок сброса пароля */}
            {mode === 'reset' && (
              <div className="pb-2 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900">Сброс пароля</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Отправим ссылку для восстановления на почту
                </p>
              </div>
            )}

            {/* Поле имени — только при регистрации */}
            {mode === 'register' && (
              <div>
                <label className="label">Ваше имя</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Иван Иванов"
                    className="input pl-10"
                    autoComplete="name"
                    autoFocus
                  />
                </div>
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
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      if (mode === 'reset') handleReset()
                    }
                  }}
                  placeholder="example@mail.ru"
                  className="input pl-10"
                  autoComplete="email"
                  autoFocus={mode !== 'register'}
                />
              </div>
            </div>

            {/* Пароль — для login и register */}
            {(mode === 'login' || mode === 'register') && (
              <div>
                <label className="label">Пароль</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && mode === 'login') handleLogin()
                    }}
                    placeholder={mode === 'register' ? 'Минимум 6 символов' : '••••••••'}
                    className="input pl-10 pr-10"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Повтор пароля — только при регистрации */}
            {mode === 'register' && (
              <div>
                <label className="label">Повторите пароль</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password2}
                    onChange={e => setPassword2(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRegister() }}
                    placeholder="Повторите пароль"
                    className="input pl-10"
                    autoComplete="new-password"
                  />
                </div>
                {/* Индикатор совпадения паролей */}
                {password2.length > 0 && (
                  <p className={`text-xs mt-1 ${password === password2 ? 'text-green-600' : 'text-rose-500'}`}>
                    {password === password2 ? '✓ Пароли совпадают' : '✗ Пароли не совпадают'}
                  </p>
                )}
              </div>
            )}

            {/* Ссылка "Забыли пароль" */}
            {mode === 'login' && (
              <div className="flex justify-end -mt-1">
                <button
                  onClick={() => switchMode('reset')}
                  className="text-xs text-indigo-600 hover:text-indigo-700 hover:underline transition-colors"
                >
                  Забыли пароль?
                </button>
              </div>
            )}

            {/* Главная кнопка */}
            <button
              onClick={
                mode === 'login'    ? handleLogin
                : mode === 'register' ? handleRegister
                : handleReset
              }
              disabled={loading}
              className="btn-primary btn-lg w-full"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  {mode === 'login' ? 'Входим...' : mode === 'register' ? 'Создаём аккаунт...' : 'Отправляем...'}
                </span>
              ) : (
                mode === 'login' ? 'Войти'
                : mode === 'register' ? 'Создать аккаунт'
                : 'Отправить ссылку'
              )}
            </button>

            {/* Кнопка "Назад" при сбросе */}
            {mode === 'reset' && (
              <button
                onClick={() => switchMode('login')}
                className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors text-center pt-1"
              >
                ← Вернуться ко входу
              </button>
            )}

          </div>
        </div>

        {mode !== 'reset' && (
          <p className="text-center text-indigo-300 text-xs mt-5">
            Регистрируясь, вы соглашаетесь с правилами сервиса
          </p>
        )}

      </div>
    </div>
  )
}
