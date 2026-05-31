'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Phone, MapPin, Eye, Star, Heart, Share2, ChevronRight, MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { MarketListing, MarketCategory, Profile } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import toast from 'react-hot-toast'

const PRICE_TYPE_LABELS: Record<string, string> = {
  fixed: '', negotiable: 'Договорная', free: 'Бесплатно', per_hour: '/час', per_day: '/день',
}
const CATEGORY_ICONS: Record<string, string> = {
  services:'🔧', real_estate:'🏠', cargo:'🚛', special_tech:'🚜', hotels:'🏨',
  cars_sale:'🚗', cars_rent:'🔑', spare_parts:'⚙️', wheels:'🛞', car_wash:'💦', car_service:'🔩',
}

export default function ListingDetailPage() {
  const router    = useRouter()
  const params    = useParams()
  const listingId = params.id as string
  const supabase  = createClient()

  const [listing,   setListing]   = useState<any>(null)
  const [isFav,     setIsFav]     = useState(false)
  const [photoIdx,  setPhotoIdx]  = useState(0)
  const [myId,      setMyId]      = useState('')
  const [loading,   setLoading]   = useState(true)
  const [showPhone, setShowPhone] = useState(false)
  const [chatLoading, setChatLoading] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setMyId(user.id)

      const { data } = await supabase
        .from('market_listings')
        .select('*, author:profiles(*), category:market_categories(*)')
        .eq('id', listingId)
        .single()
      setListing(data)

      await supabase.from('market_listings')
        .update({ views_count: (data?.views_count || 0) + 1 }).eq('id', listingId)

      if (user) {
        const { data: fav } = await supabase.from('favorites')
          .select('id').eq('user_id', user.id).eq('listing_id', listingId).single()
        setIsFav(!!fav)
      }
      setLoading(false)
    }
    load()
  }, [listingId])

  async function toggleFav() {
    if (!myId) { toast.error('Войдите в систему'); return }
    if (isFav) {
      await supabase.from('favorites').delete().eq('user_id', myId).eq('listing_id', listingId)
      setIsFav(false)
      toast('Удалено из избранного')
    } else {
      await supabase.from('favorites').insert({ user_id: myId, listing_id: listingId })
      setIsFav(true)
      toast.success('Добавлено в избранное')
    }
  }

  async function share() {
    const url = window.location.href
    if (navigator.share) await navigator.share({ title: listing?.title, url })
    else { await navigator.clipboard.writeText(url); toast.success('Ссылка скопирована') }
  }

  // Открываем или создаём чат с продавцом
  async function openChat() {
    if (!myId) { toast.error('Войдите в систему'); return }
    if (myId === listing.author_id) { toast.error('Это ваше объявление'); return }
    setChatLoading(true)

    // Ищем существующий чат
    const { data: existing } = await supabase
      .from('market_chats')
      .select('id')
      .eq('listing_id', listingId)
      .eq('buyer_id', myId)
      .single()

    if (existing) {
      router.push(`/market/chat/${existing.id}`)
      return
    }

    // Создаём новый чат
    const { data: newChat, error } = await supabase
      .from('market_chats')
      .insert({
        listing_id: listingId,
        buyer_id:   myId,
        seller_id:  listing.author_id,
        last_message: 'Чат начат',
        last_message_at: new Date().toISOString(),
      })
      .select()
      .single()

    setChatLoading(false)
    if (error) { toast.error('Ошибка создания чата'); return }
    router.push(`/market/chat/${newChat.id}`)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
    </div>
  )
  if (!listing) return <div className="p-8 text-center text-gray-500">Объявление не найдено</div>

  const cat    = listing.category as MarketCategory | undefined
  const author = listing.author   as Profile | undefined
  const photos = listing.images   || []

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.back()} className="btn-ghost p-2 rounded-xl">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <button onClick={toggleFav} className="btn-ghost p-2 rounded-xl">
              <Heart className={`w-5 h-5 ${isFav ? 'fill-rose-500 text-rose-500' : 'text-gray-400'}`} />
            </button>
            <button onClick={share} className="btn-ghost p-2 rounded-xl">
              <Share2 className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto">
        {/* Фото */}
        {photos.length > 0 ? (
          <div className="relative bg-gray-100">
            <img src={photos[photoIdx]} alt={listing.title} className="w-full h-72 object-cover" />
            {photos.length > 1 && (
              <>
                <button onClick={() => setPhotoIdx(i => Math.max(0, i-1))}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setPhotoIdx(i => Math.min(photos.length-1, i+1))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow">
                  <ChevronRight className="w-4 h-4" />
                </button>
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                  {photos.map((_: unknown, i: number) => (
                    <button key={i} onClick={() => setPhotoIdx(i)}
                      className={`w-1.5 h-1.5 rounded-full ${i===photoIdx ? 'bg-white' : 'bg-white/50'}`} />
                  ))}
                </div>
              </>
            )}
            {listing.is_promoted && <span className="absolute top-3 left-3 badge-primary">ТОП</span>}
          </div>
        ) : (
          <div className="w-full h-48 bg-gray-100 flex items-center justify-center">
            <span className="text-5xl">{CATEGORY_ICONS[cat?.slug||'']||'📦'}</span>
          </div>
        )}

        <div className="px-4 py-5 space-y-4">
          {/* Заголовок */}
          <div>
            {cat && <span className="badge-gray mb-2 inline-flex">{CATEGORY_ICONS[cat.slug]} {cat.name}</span>}
            <h1 className="text-xl font-bold text-gray-900">{listing.title}</h1>
            <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
              <div>
                {listing.price_type === 'free' ? (
                  <span className="text-2xl font-bold text-green-700">Бесплатно</span>
                ) : listing.price_type === 'negotiable' ? (
                  <span className="text-xl font-semibold text-gray-600">Договорная</span>
                ) : listing.price ? (
                  <span className="text-2xl font-bold text-gray-900">
                    {listing.price.toLocaleString('ru-RU')} ₽
                    {PRICE_TYPE_LABELS[listing.price_type] && (
                      <span className="text-base font-normal text-gray-400">{PRICE_TYPE_LABELS[listing.price_type]}</span>
                    )}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Eye className="w-3.5 h-3.5" /> {listing.views_count}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-400">
              {listing.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {listing.city}{listing.address && `, ${listing.address}`}</span>}
              <span>{formatDistanceToNow(new Date(listing.created_at), { addSuffix: true, locale: ru })}</span>
            </div>
          </div>

          {/* Описание */}
          {listing.description && (
            <div className="card p-4">
              <p className="font-semibold text-gray-900 mb-2">Описание</p>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{listing.description}</p>
            </div>
          )}

          {/* Продавец */}
          {author && (
            <div className="card p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-indigo-100">
                {author.avatar_url
                  ? <img src={author.avatar_url} className="w-12 h-12 object-cover" alt="" />
                  : <span className="font-bold text-indigo-700 text-lg">{author.full_name?.[0]||'?'}</span>
                }
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{author.full_name||'Пользователь'}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span className="text-xs text-gray-500">{Number(author.rating_passenger).toFixed(1)}</span>
                </div>
              </div>
              {myId === listing.author_id && (
                <Link href={`/market/${listing.id}/edit`} className="btn-secondary btn-sm">Редактировать</Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Кнопки — фиксированные снизу */}
      {myId !== listing.author_id && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 z-20">
          <div className="max-w-lg mx-auto flex gap-3">
            <button onClick={openChat} disabled={chatLoading}
              className="flex-1 btn-secondary py-3 flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              <span className="font-semibold text-indigo-600">Написать</span>
            </button>
            {showPhone ? (
              <a href={`tel:${listing.contact_phone}`}
                className="flex-1 btn-primary py-3 flex items-center justify-center gap-2"
              >
                <Phone className="w-5 h-5" /> {listing.contact_phone}
              </a>
            ) : (
              <button onClick={() => setShowPhone(true)}
                className="flex-1 btn-primary py-3 flex items-center justify-center gap-2"
              >
                <Phone className="w-5 h-5" /> Позвонить
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
