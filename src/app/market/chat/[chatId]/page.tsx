'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ChevronLeft, Send, ShoppingBag } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import toast from 'react-hot-toast'

export default function MarketChatPage() {
  const router   = useRouter()
  const params   = useParams()
  const chatId   = params.chatId as string
  const supabase = createClient()

  const [chat,     setChat]     = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [myId,     setMyId]     = useState('')
  const [text,     setText]     = useState('')
  const [loading,  setLoading]  = useState(true)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      setMyId(user.id)

      const { data: chatData } = await supabase
        .from('market_chats')
        .select('*, listing:market_listings(title, images), buyer:profiles!market_chats_buyer_id_fkey(full_name), seller:profiles!market_chats_seller_id_fkey(full_name)')
        .eq('id', chatId)
        .single()
      setChat(chatData)

      const { data: msgs } = await supabase
        .from('market_messages')
        .select('*, sender:profiles(full_name)')
        .eq('chat_id', chatId)
        .order('created_at')
      setMessages(msgs || [])

      // Помечаем непрочитанные как прочитанные
      await supabase.from('market_messages')
        .update({ is_read: true })
        .eq('chat_id', chatId)
        .neq('sender_id', user.id)

      setLoading(false)
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)

      // Realtime
      const channel = supabase.channel(`market-chat-${chatId}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'market_messages',
          filter: `chat_id=eq.${chatId}`,
        }, async ({ new: msg }) => {
          const { data } = await supabase
            .from('market_messages').select('*, sender:profiles(full_name)').eq('id', msg.id).single()
          setMessages(prev => [...prev, data])
          setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)

          // Помечаем как прочитанное если от собеседника
          if (msg.sender_id !== user.id) {
            await supabase.from('market_messages').update({ is_read: true }).eq('id', msg.id)
          }
        })
        .subscribe()
      return () => { supabase.removeChannel(channel) }
    }
    load()
  }, [chatId])

  async function send() {
    if (!text.trim()) return
    const msg = text.trim()
    setText('')

    const { error } = await supabase.from('market_messages').insert({
      chat_id: chatId, sender_id: myId, message: msg
    })
    if (error) { toast.error('Ошибка отправки'); setText(msg) }

    // Обновляем last_message в чате
    await supabase.from('market_chats').update({
      last_message: msg, last_message_at: new Date().toISOString()
    }).eq('id', chatId)
  }

  const interlocutor = chat
    ? (myId === chat.buyer_id ? chat.seller : chat.buyer)
    : null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col">
      <header className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="btn-ghost p-2 rounded-xl">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
              {interlocutor?.full_name || 'Собеседник'}
            </p>
            {chat?.listing && (
              <p className="text-xs text-gray-400 dark:text-slate-500 truncate flex items-center gap-1">
                <ShoppingBag className="w-3 h-3" />
                {chat.listing.title}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Объявление */}
      {chat?.listing && (
        <div className="bg-indigo-50 dark:bg-indigo-900/30 border-b border-indigo-100 dark:border-indigo-900/50 px-4 py-2">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            {chat.listing.images?.[0] ? (
              <img src={chat.listing.images[0]} className="w-10 h-10 rounded-lg object-cover" alt="" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-indigo-400" />
              </div>
            )}
            <p className="text-sm font-medium text-indigo-700 truncate">{chat.listing.title}</p>
          </div>
        </div>
      )}

      {/* Сообщения */}
      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 dark:text-slate-500 text-sm">Начните переписку</p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg, i) => {
              const isMine = msg.sender_id === myId
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs px-3 py-2 rounded-2xl text-sm ${
                    isMine
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 border border-gray-100 dark:border-slate-700 rounded-bl-sm'
                  }`}>
                    <p>{msg.message}</p>
                    <p className={`text-xs mt-0.5 ${isMine ? 'text-indigo-200' : 'text-gray-400 dark:text-slate-500'}`}>
                      {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: ru })}
                    </p>
                  </div>
                </div>
              )
            })}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Поле ввода */}
      <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 px-4 py-3">
        <div className="max-w-lg mx-auto flex gap-2">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Сообщение..."
            className="input py-2.5 flex-1"
          />
          <button
            onClick={send}
            disabled={!text.trim()}
            className="btn-primary px-4 py-2.5 rounded-xl disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
