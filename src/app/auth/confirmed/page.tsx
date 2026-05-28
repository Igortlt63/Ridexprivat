'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Car, CheckCircle } from 'lucide-react'

export default function ConfirmedPage() {
  const router = useRouter()

  useEffect(() => {
    // Через 3 секунды редиректим на главную
    const timer = setTimeout(() => router.push('/'), 3000)
    return () => clearTimeout(timer)
  }, [])

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
          <h2 className="text-xl font-bold text-gray-900 mb-2">Email подтверждён!</h2>
          <p className="text-gray-500 text-sm mb-6">
            Аккаунт активирован. Переходим в приложение...
          </p>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent" />
          </div>
        </div>
      </div>
    </div>
  )
}
