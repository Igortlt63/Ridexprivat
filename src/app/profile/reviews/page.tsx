'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Review, Profile } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'

type ReviewWithProfiles = Review & {
  reviewer?: Pick<Profile, 'full_name' | 'avatar_url'> | null
  reviewed?: Pick<Profile, 'full_name'> | null
}

export default function ReviewsPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [reviews, setReviews] = useState<ReviewWithProfiles[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState<'received' | 'given'>('received')
  const [myId, setMyId]       = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      setMyId(user.id)
      await loadReviews(user.id, 'received')
      setLoading(false)
    }
    load()
  }, [])

  async function loadReviews(uid: string, type: 'received' | 'given') {
    const field = type === 'received' ? 'reviewed_id' : 'reviewer_id'
    const { data } = await supabase
      .from('reviews')
      .select('*, reviewer:profiles!reviews_reviewer_id_fkey(full_name, avatar_url), reviewed:profiles!reviews_reviewed_id_fkey(full_name)')
      .eq(field, uid)
      .order('created_at', { ascending: false })
    setReviews((data as ReviewWithProfiles[]) || [])
  }

  async function switchTab(t: 'received' | 'given') {
    setTab(t)
    setLoading(true)
    await loadReviews(myId, t)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="btn-ghost p-2 rounded-xl">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Отзывы</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-5">
        <div className="flex gap-2 mb-4">
          {(['received', 'given'] as const).map(t => (
            <button key={t} onClick={() => switchTab(t)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                tab === t ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {t === 'received' ? 'Обо мне' : 'Мои отзывы'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="card p-10 text-center">
            <Star className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500">Отзывов пока нет</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map(r => (
              <div key={r.id} className="card p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-indigo-600">
                      {r.reviewer?.full_name?.[0] || '?'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{r.reviewer?.full_name || 'Пользователь'}</p>
                    <p className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ru })}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} className={`w-4 h-4 ${i <= r.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                    ))}
                  </div>
                </div>
                {r.comment && (
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{r.comment}</p>
                )}
                <span className={`mt-2 inline-block text-xs px-2 py-0.5 rounded-full ${
                  r.role_reviewed === 'driver' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
                }`}>
                  {r.role_reviewed === 'driver' ? 'Как водитель' : 'Как пассажир'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
