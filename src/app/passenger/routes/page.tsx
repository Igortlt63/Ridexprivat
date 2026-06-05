'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, MapPin, Plus, Trash2, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { SavedRoute } from '@/types'
import toast from 'react-hot-toast'

export default function SavedRoutesPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [routes,  setRoutes]  = useState<SavedRoute[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      const { data } = await supabase
        .from('saved_routes').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      setRoutes((data as SavedRoute[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  async function deleteRoute(id: string) {
    await supabase.from('saved_routes').delete().eq('id', id)
    setRoutes(prev => prev.filter(r => r.id !== id))
    toast.success('Маршрут удалён')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="btn-ghost p-2 rounded-xl">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Сохранённые маршруты</h1>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : routes.length === 0 ? (
          <div className="card p-10 text-center">
            <MapPin className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Нет сохранённых маршрутов</p>
            <p className="text-xs text-gray-400 mt-1">Создайте поездку — маршруты появятся здесь</p>
            <Link href="/passenger/new-ride" className="btn-primary btn-sm mt-4 inline-flex">
              Создать заявку
            </Link>
          </div>
        ) : routes.map(route => (
          <div key={route.id} className="card p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white">{route.name}</p>
                <div className="mt-1.5 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0" />
                    <span className="truncate">{route.origin_address}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <div className="w-1.5 h-1.5 bg-rose-500 rounded-full flex-shrink-0" />
                    <span className="truncate">{route.dest_address}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Link
                  href={`/passenger/new-ride?origin=${encodeURIComponent(route.origin_address)}&dest=${encodeURIComponent(route.dest_address)}&olat=${route.origin_lat}&olng=${route.origin_lng}&dlat=${route.dest_lat}&dlng=${route.dest_lng}`}
                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  title="Использовать маршрут"
                >
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <button onClick={() => deleteRoute(route.id)}
                  className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
