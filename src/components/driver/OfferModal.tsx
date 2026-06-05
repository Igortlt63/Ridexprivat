'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import type { Ride } from '@/types'

interface Props {
  ride:      Ride
  myId:      string
  vehicleId?: string
  onClose:   () => void
}

export default function OfferModal({ ride, myId, vehicleId, onClose }: Props) {
  const supabase = createClient()
  const [price,   setPrice]   = useState(ride.passenger_price)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  async function send() {
    setSending(true)
    const { error } = await supabase.from('ride_offers').insert({
      ride_id:       ride.id,
      driver_id:     myId,
      vehicle_id:    vehicleId || null,
      offered_price: price,
      message:       message.trim() || null,
      status:        'pending',
    })
    if (!error) {
      await supabase.from('rides')
        .update({ status: 'negotiating' })
        .eq('id', ride.id)
      toast.success('Предложение отправлено!')
    } else {
      toast.error('Ошибка: ' + error.message)
    }
    setSending(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">Предложить цену</h3>

        <div className="mb-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-0.5">Цена пассажира</p>
          <p className="font-bold text-gray-900 dark:text-white">
            {ride.passenger_price.toLocaleString('ru-RU')} ₽
          </p>
        </div>

        <div className="mb-3">
          <label className="label">Ваша цена (₽)</label>
          <input
            type="number"
            value={price}
            onChange={e => setPrice(Number(e.target.value))}
            className="input text-lg font-semibold"
            min={1}
          />
        </div>

        <div className="mb-5">
          <label className="label">Сообщение пассажиру</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Расскажите о себе или авто..."
            className="input resize-none"
            rows={2}
          />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 btn-secondary">Отмена</button>
          <button onClick={send} disabled={sending} className="flex-1 btn-primary">
            {sending ? '...' : 'Отправить'}
          </button>
        </div>
      </div>
    </div>
  )
}
