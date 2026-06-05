'use client'

import { Star, Users, Luggage, PawPrint, CigaretteOff, MessageSquare, Banknote } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { Ride } from '@/types'

interface Props {
  ride:    Ride
  onOffer: (r: Ride) => void
}

export default function RideCard({ ride, onOffer }: Props) {
  return (
    <div className="card p-4 animate-fade-in">
      {/* Пассажир */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
          {ride.passenger?.avatar_url
            ? <img src={ride.passenger.avatar_url} className="w-9 h-9 object-cover" alt="" />
            : <span className="text-sm font-bold text-indigo-700">
                {ride.passenger?.full_name?.[0] || '?'}
              </span>
          }
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm text-gray-900 dark:text-white">
            {ride.passenger?.full_name || 'Пассажир'}
          </p>
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span className="text-xs text-gray-500 dark:text-slate-400">
              {Number(ride.passenger?.rating_passenger || 5).toFixed(1)}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-lg text-gray-900 dark:text-white">
            {ride.passenger_price.toLocaleString('ru-RU')} ₽
          </p>
          <p className="text-xs text-gray-400 dark:text-slate-500">
            {formatDistanceToNow(new Date(ride.created_at), { addSuffix: true, locale: ru })}
          </p>
        </div>
      </div>

      {/* Маршрут */}
      <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3 mb-3 space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
          <span className="truncate">{ride.origin_address}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <div className="w-2 h-2 bg-rose-500 rounded-full flex-shrink-0" />
          <span className="truncate">{ride.dest_address}</span>
        </div>
      </div>

      {/* Теги */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {ride.seats_needed > 1 && (
          <span className="flex items-center gap-1 text-xs bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 px-2 py-1 rounded-full">
            <Users className="w-3 h-3" /> {ride.seats_needed} места
          </span>
        )}
        {ride.allow_luggage && (
          <span className="flex items-center gap-1 text-xs bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 px-2 py-1 rounded-full">
            <Luggage className="w-3 h-3" /> Багаж
          </span>
        )}
        {ride.allow_pets && (
          <span className="flex items-center gap-1 text-xs bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 px-2 py-1 rounded-full">
            <PawPrint className="w-3 h-3" /> Животное
          </span>
        )}
        {ride.no_smoking && (
          <span className="flex items-center gap-1 text-xs bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 px-2 py-1 rounded-full">
            <CigaretteOff className="w-3 h-3" /> Не курить
          </span>
        )}
        {ride.ride_type === 'intercity' && (
          <span className="badge-primary text-xs">Межгород</span>
        )}
      </div>

      {/* Комментарий */}
      {ride.comment && (
        <div className="flex gap-2 mb-3 text-xs text-gray-500 dark:text-slate-400 bg-gray-50 rounded-lg px-3 py-2">
          <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <p className="line-clamp-2">{ride.comment}</p>
        </div>
      )}

      {/* Кнопки */}
      <div className="flex gap-2">
        <button onClick={() => onOffer(ride)} className="flex-1 btn-primary btn-sm">
          Принять — {ride.passenger_price.toLocaleString('ru-RU')} ₽
        </button>
        <button
          onClick={() => onOffer(ride)}
          className="btn-secondary btn-sm px-3"
          title="Предложить другую цену"
          aria-label="Предложить другую цену"
        >
          <Banknote className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
