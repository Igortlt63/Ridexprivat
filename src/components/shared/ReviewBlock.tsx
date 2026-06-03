'use client'

import { useState } from 'react'
import { Star, CheckCircle } from 'lucide-react'

interface Props {
  /** Кого оцениваем: 'водителя' | 'пассажира' */
  targetLabel: string
  onSubmit: (rating: number, comment: string) => Promise<void>
}

export default function ReviewBlock({ targetLabel, onSubmit }: Props) {
  const [rating,  setRating]  = useState(5)
  const [comment, setComment] = useState('')
  const [sent,    setSent]    = useState(false)
  const [sending, setSending] = useState(false)

  if (sent) return (
    <div className="card p-4 text-center bg-green-50">
      <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-1" />
      <p className="text-sm font-medium text-green-700">Отзыв отправлен!</p>
    </div>
  )

  return (
    <div className="card p-4 space-y-3">
      <p className="font-semibold text-gray-900">Оцените {targetLabel}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <button key={i} type="button" onClick={() => setRating(i)}
            aria-label={`${i} звезда`}>
            <Star className={`w-7 h-7 transition-colors ${
              i <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'
            }`} />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Комментарий (необязательно)..."
        className="input resize-none"
        rows={2}
      />
      <button
        disabled={sending}
        onClick={async () => {
          setSending(true)
          await onSubmit(rating, comment)
          setSent(true)
          setSending(false)
        }}
        className="btn-primary w-full disabled:opacity-60"
      >
        {sending ? 'Отправляем...' : 'Отправить отзыв'}
      </button>
    </div>
  )
}
