'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Mail, MessageSquare, ChevronRight, Car } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function AuthPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep]       = useState<'email' | 'otp'>('email')
  const [email, setEmail]     = useState('')
  const [otp, setOtp]         = useState('')
  const [loading, setLoading] = useState(false)

  async function sendOtp() {
    if (!email || !email.includes('@')) {
      toast.error('Введите корректный email')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
    setLoading(false)

    if (error) { toast.error('Ошибка: ' + error.message); return }
    toast.success('Код отправлен на ' + email)
    setStep('otp')
  }

  async function verifyOtp() {
    if (otp.length < 6) { toast.error('Введите 6-значный код'); return }
    setLoading(true)
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    })
    setLoading(false)

    if (error) { toast.error('Неверный код. Попробуйте ещё раз.'); return }
    toast.success('Добро пожаловать!')
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur mb-4">
            <Car className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">РидМаркет</h1>
          <p className="text-indigo-200 mt-1 text-sm">Поездки с договорной ценой</p>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          {step === 'email' ? (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">Вход в систему</h2>
                  <p className="text-xs text-gray-500">Введите ваш email</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="label">Email адрес</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendOtp()}
                    placeholder="example@mail.ru"
                    className="input text-base"
                    autoFocus
                    autoComplete="email"
                  />
                </div>
                <button onClick={sendOtp} disabled={loading} className="btn-primary btn-lg w-full">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Отправляем...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">Получить код <ChevronRight className="w-4 h-4" /></span>
                  )}
                </button>
              </div>
              <p className="mt-6 text-center text-xs text-gray-400">На почту придёт 6-значный код для входа</p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-green-700" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">Введите код</h2>
                  <p className="text-xs text-gray-500">Отправили письмо на {email}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="label">Код из письма</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={e => e.key === 'Enter' && verifyOtp()}
                    placeholder="000000"
                    className="input text-2xl tracking-[0.5em] text-center font-mono"
                    autoFocus
                    autoComplete="one-time-code"
                  />
                </div>
                <button onClick={verifyOtp} disabled={loading} className="btn-primary btn-lg w-full">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Проверяем...
                    </span>
                  ) : 'Войти'}
                </button>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
                <button onClick={() => { setStep('email'); setOtp('') }} className="hover:text-indigo-600 transition-colors">
                  ← Изменить email
                </button>
                <button onClick={sendOtp} disabled={loading} className="hover:text-indigo-600 transition-colors">
                  Отправить повторно
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
