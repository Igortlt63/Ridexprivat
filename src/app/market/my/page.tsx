'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ChevronLeft, Plus, Eye, Edit, Trash2, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { MarketListing, ListingStatus } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'

type FilterStatus = ListingStatus | 'all'

const STATUS_LABEL: Record<ListingStatus, { label: string; color: string; bg: string }> = {
  active:      { label: 'Активно',       color: 'text-green-700',  bg: 'bg-green-50' },
  inactive:    { label: 'Скрыто',        color: 'text-gray-500 dark:text-slate-400',   bg: 'bg-gray-100' },
  sold:        { label: 'Продано',       color: 'text-blue-700',   bg: 'bg-blue-50'  },
  moderation:  { label: 'На проверке',   color: 'text-amber-700',  bg: 'bg-amber-50' },
}

export default function MyListingsPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [listings,  setListings]  = useState<MarketListing[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState<FilterStatus>('all')
  const [deleting,  setDeleting]  = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      const { data, error } = await supabase
        .from('market_listings')
        .select('*, category:market_categories(name, slug, icon)')
        .eq('author_id', user.id)
        .order('created_at', { ascending: false })

      if (error) toast.error('Ошибка загрузки: ' + error.message)
      setListings((data as MarketListing[]) || [])
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleStatus(listing: MarketListing) {
    const next: ListingStatus = listing.status === 'active' ? 'inactive' : 'active'
    const { error } = await supabase
      .from('market_listings')
      .update({ status: next })
      .eq('id', listing.id)
    if (error) { toast.error('Ошибка: ' + error.message); return }
    setListings(prev => prev.map(l => l.id === listing.id ? { ...l, status: next } : l))
    toast.success(next === 'active' ? 'Объявление опубликовано' : 'Объявление скрыто')
  }

  async function deleteListing(id: string) {
    if (!confirm('Удалить объявление? Это действие нельзя отменить.')) return
    setDeleting(id)
    const { error } = await supabase.from('market_listings').delete().eq('id', id)
    if (error) { toast.error('Ошибка удаления: ' + error.message); setDeleting(null); return }
    setListings(prev => prev.filter(l => l.id !== id))
    toast.success('Объявление удалено')
    setDeleting(null)
  }

  const displayed = filter === 'all'
    ? listings
    : listings.filter(l => l.status === filter)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="btn-ghost p-2 rounded-xl" aria-label="Назад">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Мои объявления</h1>
          </div>
          <Link href="/market/new" className="btn-primary btn-sm gap-1.5">
            <Plus className="w-4 h-4" /> Новое
          </Link>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">

        {/* Фильтр по статусу */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {([
            { key: 'all',       label: `Все (${listings.length})` },
            { key: 'active',    label: 'Активные' },
            { key: 'inactive',  label: 'Скрытые' },
            { key: 'sold',      label: 'Проданные' },
            { key: 'moderation',label: 'На проверке' },
          ] as const).map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === f.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-2xl mb-2">📭</p>
            <p className="text-gray-500 dark:text-slate-400 font-medium">
              {filter === 'all' ? 'У вас пока нет объявлений' : 'Нет объявлений с таким статусом'}
            </p>
            {filter === 'all' && (
              <Link href="/market/new" className="btn-primary btn-sm mt-4 inline-flex gap-1.5">
                <Plus className="w-4 h-4" /> Подать первое
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map(listing => {
              const cat = listing.category as { name: string; slug: string; icon?: string } | undefined
              const st  = STATUS_LABEL[listing.status] || STATUS_LABEL.inactive
              return (
                <div key={listing.id} className="card p-4">
                  <div className="flex gap-3">
                    {/* Фото или заглушка */}
                    {listing.images?.[0] ? (
                      <img
                        src={listing.images[0]}
                        alt={listing.title}
                        className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">{cat?.icon || '📦'}</span>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-1">{listing.title}</p>
                      {/* Цена */}
                      <p className="text-sm font-bold text-gray-800 mt-0.5">
                        {listing.price_type === 'free' ? 'Бесплатно'
                          : listing.price_type === 'negotiable' ? 'Договорная'
                          : listing.price ? `${listing.price.toLocaleString('ru-RU')} ₽` : '—'
                        }
                      </p>
                      {/* Мета */}
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 dark:text-slate-500 flex-wrap">
                        {listing.city && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="w-3 h-3" /> {listing.city}
                          </span>
                        )}
                        <span className="flex items-center gap-0.5">
                          <Eye className="w-3 h-3" /> {listing.views_count}
                        </span>
                        <span>{formatDistanceToNow(new Date(listing.created_at), { addSuffix: true, locale: ru })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Статус + действия */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50 dark:border-slate-800">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${st.bg} ${st.color}`}>
                      {st.label}
                    </span>
                    <div className="flex items-center gap-1">
                      {/* Скрыть/Показать (только active/inactive) */}
                      {(listing.status === 'active' || listing.status === 'inactive') && (
                        <button
                          onClick={() => toggleStatus(listing)}
                          className="text-xs px-2.5 py-1.5 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 transition-colors"
                        >
                          {listing.status === 'active' ? 'Скрыть' : 'Опубликовать'}
                        </button>
                      )}
                      <Link
                        href={`/market/${listing.id}`}
                        className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                        aria-label="Открыть объявление"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => deleteListing(listing.id)}
                        disabled={deleting === listing.id}
                        className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                        aria-label="Удалить объявление"
                      >
                        {deleting === listing.id
                          ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-rose-400 border-t-transparent inline-block" />
                          : <Trash2 className="w-4 h-4" />
                        }
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
