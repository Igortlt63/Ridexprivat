'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Plus, Eye, Edit3, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { MarketListing, MarketCategory } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import toast from 'react-hot-toast'

const CATEGORY_ICONS: Record<string, string> = {
  services:'🔧', real_estate:'🏠', cargo:'🚛', special_tech:'🚜', hotels:'🏨',
  cars_sale:'🚗', cars_rent:'🔑', spare_parts:'⚙️', wheels:'🛞', car_wash:'💦', car_service:'🔩',
}

export default function MyListingsPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [listings, setListings] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      const { data } = await supabase
        .from('market_listings')
        .select('*, category:market_categories(name, slug)')
        .eq('author_id', user.id)
        .neq('status', 'sold')
        .order('created_at', { ascending: false })
      setListings(data || [])
      setLoading(false)
    }
    load()
  }, [])

  async function toggleStatus(id: string, current: string) {
    const newStatus = current === 'active' ? 'inactive' : 'active'
    await supabase.from('market_listings').update({ status: newStatus }).eq('id', id)
    setListings(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l))
    toast.success(newStatus === 'active' ? 'Объявление активировано' : 'Объявление скрыто')
  }

  async function deleteListing(id: string) {
    if (!confirm('Удалить объявление?')) return
    await supabase.from('market_listings').update({ status: 'sold' }).eq('id', id)
    setListings(prev => prev.filter(l => l.id !== id))
    toast.success('Объявление удалено')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="btn-ghost p-2 rounded-xl">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">Мои объявления</h1>
          </div>
          <Link href="/market/new" className="btn-primary btn-sm gap-1.5">
            <Plus className="w-4 h-4" /> Подать
          </Link>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : listings.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-3xl mb-3">📢</p>
            <p className="text-gray-500 font-medium">У вас нет объявлений</p>
            <Link href="/market/new" className="btn-primary btn-sm mt-4 inline-flex">
              Подать первое объявление
            </Link>
          </div>
        ) : listings.map(l => (
          <div key={l.id} className="card p-4">
            <div className="flex gap-3">
              {l.images?.[0] ? (
                <img src={l.images[0]} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" alt="" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">{CATEGORY_ICONS[l.category?.slug] || '📦'}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">{l.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {l.category?.name} · {formatDistanceToNow(new Date(l.created_at), { addSuffix: true, locale: ru })}
                </p>
                {l.price && (
                  <p className="font-bold text-indigo-600 text-sm mt-1">
                    {l.price.toLocaleString('ru-RU')} ₽
                  </p>
                )}
                <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                  <Eye className="w-3 h-3" /> {l.views_count} просмотров
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  l.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {l.status === 'active' ? 'Активно' : 'Скрыто'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => toggleStatus(l.id, l.status)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg transition-colors">
                  {l.status === 'active'
                    ? <ToggleRight className="w-5 h-5 text-indigo-600" />
                    : <ToggleLeft className="w-5 h-5" />
                  }
                </button>
                <Link href={`/market/${l.id}/edit`} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg transition-colors">
                  <Edit3 className="w-4 h-4" />
                </Link>
                <button onClick={() => deleteListing(l.id)} className="p-1.5 text-gray-400 hover:text-rose-500 rounded-lg transition-colors">
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
