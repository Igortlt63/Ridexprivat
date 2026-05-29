'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, MessageSquare, ShoppingBag, Car } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'

export default function ChatsPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [marketChats, setMarketChats] = useState<any[]>([])
  const [rideChats,   setRideChats]   = useState<any[]>([])
  const [myId,  setMyId]  = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'market' | 'rides'>('market')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      setMyId(user.id)

      // Чаты маркета
      const { data: mc } = await supabase
        .from('market_chats')
        .select('*, listing:market_listings(title, images), buyer:profiles!market_chats_buyer_id_fkey(full_name), seller:profiles!market_chats_seller_id_fkey(full_name)')
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false })
      setMarketChats(mc || [])

      // Поездки с сообщениями
      const { data: rc } = await supabase
        .from('rides')
        .select('*, passenger:profiles!rides_passenger_id_fkey(full_name), driver:profiles!rides_driver_id_fkey(full_name)')
        .or(`passenger_id.eq.${user.id},driver_id.eq.${user.id}`)
        .in('status', ['accepted', 'in_progress', 'completed'])
        .order('updated_at', { ascending: false })
        .limit(20)
      setRideChats(rc || [])

      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="btn-ghost p-2 rounded-xl">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Сообщения</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="flex gap-2 mb-4">
          <button onClick={() => setTab('market')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              tab === 'market' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            <ShoppingBag className="w-4 h-4" /> Маркет
          </button>
          <button onClick={() => setTab('rides')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              tab === 'rides' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            <Car className="w-4 h-4" /> Поездки
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : tab === 'market' ? (
          marketChats.length === 0 ? (
            <div className="card p-10 text-center">
              <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500">Нет сообщений в маркете</p>
            </div>
          ) : (
            <div className="space-y-2">
              {marketChats.map(chat => {
                const other = myId === chat.buyer_id ? chat.seller : chat.buyer
                return (
                  <Link key={chat.id} href={`/market/chat/${chat.id}`}
                    className="card p-4 flex items-center gap-3 hover:shadow-md transition-all active:scale-95"
                  >
                    <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      {chat.listing?.images?.[0]
                        ? <img src={chat.listing.images[0]} className="w-12 h-12 rounded-xl object-cover" alt="" />
                        : <ShoppingBag className="w-6 h-6 text-indigo-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{other?.full_name || 'Пользователь'}</p>
                      <p className="text-xs text-gray-400 truncate">{chat.listing?.title}</p>
                      {chat.last_message && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">{chat.last_message}</p>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 flex-shrink-0">
                      {formatDistanceToNow(new Date(chat.last_message_at), { addSuffix: true, locale: ru })}
                    </p>
                  </Link>
                )
              })}
            </div>
          )
        ) : (
          rideChats.length === 0 ? (
            <div className="card p-10 text-center">
              <Car className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500">Нет активных поездок</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rideChats.map(ride => {
                const other = myId === ride.passenger_id ? ride.driver : ride.passenger
                return (
                  <Link key={ride.id} href={`/passenger/ride/${ride.id}`}
                    className="card p-4 flex items-center gap-3 hover:shadow-md transition-all active:scale-95"
                  >
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Car className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{other?.full_name || 'Участник'}</p>
                      <p className="text-xs text-gray-400 truncate">{ride.origin_address} → {ride.dest_address}</p>
                      <p className="text-xs font-semibold text-indigo-600 mt-0.5">
                        {(ride.final_price || ride.passenger_price).toLocaleString('ru-RU')} ₽
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          )
        )}
      </div>
    </div>
  )
}
