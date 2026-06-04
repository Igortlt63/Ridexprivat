'use client'

// src/app/market/page.tsx
// Маркет — главная страница с категориями и объявлениями

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Search, ChevronLeft, Star, MapPin, Eye } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { MarketCategory, MarketListing } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'

const CATEGORY_ICONS: Record<string, string> = {
  services:     '🔧',
  real_estate:  '🏠',
  cargo:        '🚛',
  special_tech: '🚜',
  hotels:       '🏨',
  cars_sale:    '🚗',
  cars_rent:    '🔑',
  spare_parts:  '⚙️',
  wheels:       '🛞',
  car_wash:     '💦',
  car_service:  '🔩',
}

const PRICE_TYPE_LABELS: Record<string, string> = {
  fixed:      '',
  negotiable: 'Договорная',
  free:       'Бесплатно',
  per_hour:   '/час',
  per_day:    '/день',
}

export default function MarketPage() {
  const router = useRouter()
  const supabase = createClient()

  const [categories,   setCategories]   = useState<MarketCategory[]>([])
  const [listings,     setListings]     = useState<MarketListing[]>([])
  const [selected,     setSelected]     = useState<number | null>(null)
  const [search,       setSearch]       = useState('')
  const [loading,      setLoading]      = useState(true)
  const [loadingMore,  setLoadingMore]  = useState(false)
  const [hasMore,      setHasMore]      = useState(false)
  const [offset,       setOffset]       = useState(0)

  const PAGE_SIZE = 30

  useEffect(() => {
    async function load() {
      const { data: cats } = await supabase
        .from('market_categories')
        .select('*')
        .order('sort_order')
      setCategories(cats || [])
      await loadListings(null, '')
      setLoading(false)
    }
    load()

    // Realtime — новые объявления появляются автоматически
    const channel = supabase.channel('market-listings-live')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'market_listings',
      }, async ({ new: listing }) => {
        // Подгружаем полные данные с категорией и автором
        const { data } = await supabase
          .from('market_listings')
          .select('*, category:market_categories(*), author:profiles(*)')
          .eq('id', listing.id).single()
        if (data && data.status === 'active') {
          setListings(prev => {
            if (prev.find(l => l.id === data.id)) return prev
            return [data as MarketListing, ...prev]
          })
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'market_listings',
      }, ({ new: updated }) => {
        setListings(prev => {
          // Если объявление стало неактивным — убираем
          if (updated.status !== 'active') {
            return prev.filter(l => l.id !== updated.id)
          }
          return prev.map(l => l.id === updated.id ? { ...l, ...updated } as MarketListing : l)
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadListings(categoryId: number | null, q: string, startOffset = 0, append = false) {
    if (append) setLoadingMore(true)
    else setLoading(true)

    let query = supabase
      .from('market_listings')
      .select('*, author:profiles(full_name, rating_passenger), category:market_categories(name, slug)')
      .eq('status', 'active')
      .order('is_promoted', { ascending: false })
      .order('created_at', { ascending: false })
      .range(startOffset, startOffset + PAGE_SIZE - 1)

    if (categoryId) query = query.eq('category_id', categoryId)
    if (q.trim())   query = query.ilike('title', `%${q.trim()}%`)

    const { data } = await query
    const items = (data as MarketListing[]) || []

    if (append) {
      setListings(prev => [...prev, ...items])
    } else {
      setListings(items)
      setOffset(0)
    }
    setHasMore(items.length === PAGE_SIZE)
    if (append) setLoadingMore(false)
    else setLoading(false)
  }

  async function loadMore() {
    const nextOffset = offset + PAGE_SIZE
    setOffset(nextOffset)
    await loadListings(selected, search, nextOffset, true)
  }

  function selectCategory(id: number | null) {
    setSelected(id)
    loadListings(id, search)
  }

  function handleSearch(q: string) {
    setSearch(q)
    loadListings(selected, q)
  }

  const currentCat = categories.find(c => c.id === selected)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Шапка */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button onClick={() => router.back()} className="btn-ghost p-2 rounded-xl">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-gray-900">Маркет</h1>
            </div>
            <Link href="/market/new" className="btn-primary btn-sm gap-1.5">
              <Plus className="w-4 h-4" /> Подать
            </Link>
          </div>

          {/* Поиск */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Поиск по объявлениям..."
              className="input pl-9 py-2 text-sm"
            />
          </div>

          {/* Категории (горизонтальный скролл) */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
            <button
              onClick={() => selectCategory(null)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selected === null
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Все
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => selectCategory(cat.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selected === cat.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span>{CATEGORY_ICONS[cat.slug] || '📦'}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        {/* Заголовок секции */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-500">
            {currentCat
              ? `${CATEGORY_ICONS[currentCat.slug]} ${currentCat.name}`
              : 'Все объявления'
            }
            {!loading && <span className="ml-1 text-gray-400">· {listings.length}</span>}
          </p>
        </div>

        {/* Список объявлений */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : listings.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-gray-500 font-medium">Объявлений не найдено</p>
            <p className="text-xs text-gray-400 mt-1">Попробуйте другую категорию</p>
            <Link href="/market/new" className="btn-primary btn-sm mt-4 inline-flex">
              Подать первым
            </Link>
          </div>
        ) : selected !== null ? (
          // Конкретная категория — просто список
          <div className="space-y-3">
            {listings.map(listing => (
              <ListingCard key={listing.id} listing={listing} />
            ))}

            {/* Пагинация */}
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-3 rounded-xl text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Загрузка...' : 'Загрузить ещё объявления'}
              </button>
            )}
          </div>
        ) : (
          // Режим «Все» — группируем по категориям
          <div className="space-y-6">
            {categories.map(cat => {
              const catListings = listings.filter(l => l.category_id === cat.id)
              if (catListings.length === 0) return null
              return (
                <div key={cat.id}>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                      <span>{CATEGORY_ICONS[cat.slug] || '📦'}</span>
                      <span>{cat.name}</span>
                      <span className="text-gray-400 font-normal">({catListings.length})</span>
                    </h2>
                    <button
                      onClick={() => selectCategory(cat.id)}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      Все →
                    </button>
                  </div>
                  <div className="space-y-3">
                    {catListings.slice(0, 3).map(listing => (
                      <ListingCard key={listing.id} listing={listing} />
                    ))}
                  </div>
                </div>
              )
            })}
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-3 rounded-xl text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Загрузка...' : 'Загрузить ещё объявления'}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

// ── Карточка объявления ────────────────────────────────────────
function ListingCard({ listing }: { listing: MarketListing & { category?: MarketCategory } }) {
  const cat = listing.category as MarketCategory | undefined
  const slug = cat?.slug || ''

  return (
    <Link
      href={`/market/${listing.id}`}
      className={`card block hover:shadow-card-hover transition-all active:scale-95 overflow-hidden ${
        listing.is_promoted ? 'ring-2 ring-indigo-200' : ''
      }`}
    >
      <div className="flex gap-3 p-4">
        {/* Фото или заглушка */}
        {listing.images?.[0] ? (
          <img
            src={listing.images[0]}
            alt={listing.title}
            className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 flex-shrink-0">
            <span className="text-2xl">{CATEGORY_ICONS[slug] || '📦'}</span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">
              {listing.title}
            </p>
            {listing.is_promoted && (
              <span className="badge-primary flex-shrink-0 text-xs">ТОП</span>
            )}
          </div>

          {/* Цена */}
          <div className="mt-1">
            {listing.price_type === 'free' ? (
              <span className="text-green-700 font-bold text-sm">Бесплатно</span>
            ) : listing.price_type === 'negotiable' ? (
              <span className="text-gray-600 text-sm">Договорная</span>
            ) : listing.price ? (
              <span className="font-bold text-gray-900">
                {listing.price.toLocaleString('ru-RU')} ₽
                {PRICE_TYPE_LABELS[listing.price_type] && (
                  <span className="text-gray-400 font-normal text-xs">
                    {PRICE_TYPE_LABELS[listing.price_type]}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-gray-400 text-sm">Цена не указана</span>
            )}
          </div>

          {/* Мета */}
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
            {listing.city && (
              <span className="flex items-center gap-0.5">
                <MapPin className="w-3 h-3" /> {listing.city}
              </span>
            )}
            <span className="flex items-center gap-0.5">
              <Eye className="w-3 h-3" /> {listing.views_count}
            </span>
            <span>
              {formatDistanceToNow(new Date(listing.created_at), { addSuffix: true, locale: ru })}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}