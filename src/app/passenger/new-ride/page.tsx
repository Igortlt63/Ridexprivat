'use client'

// src/app/passenger/new-ride/page.tsx
// Форма создания заявки на поездку

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import {
  MapPin, Navigation, ChevronLeft, Luggage, PawPrint,
  CigaretteOff, Users, MessageSquare, Banknote, ArrowUpDown
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { CreateRideForm } from '@/types'

// ── Схема валидации ────────────────────────────────────────────
const rideSchema = z.object({
  origin_address:  z.string().min(3, 'Введите адрес отправления'),
  origin_lat:      z.number(),
  origin_lng:      z.number(),
  dest_address:    z.string().min(3, 'Введите адрес назначения'),
  dest_lat:        z.number(),
  dest_lng:        z.number(),
  passenger_price: z.number().min(1, 'Укажите цену').max(999999, 'Слишком большая цена'),
  seats_needed:    z.number().min(1).max(8),
  comment:         z.string().max(300).optional().default(''),
  allow_luggage:   z.boolean().default(false),
  allow_pets:      z.boolean().default(false),
  no_smoking:      z.boolean().default(false),
  ride_type:       z.enum(['city', 'intercity']).default('city'),
})

type RideFormData = z.infer<typeof rideSchema>

// ── Саджест адресов через Яндекс Геокодер ─────────────────────
async function suggestAddresses(query: string): Promise<Array<{address: string, lat: number, lng: number}>> {
  if (!query || query.length < 3) return []
  try {
    const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_KEY || ''
    const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${apiKey}&geocode=${encodeURIComponent(query)}&results=5&format=json&lang=ru_RU`
    const res = await fetch(url)
    const json = await res.json()
    const members = json?.response?.GeoObjectCollection?.featureMember || []
    return members.map((m: any) => {
      const obj = m.GeoObject
      const coords = obj.Point.pos.split(' ').map(Number)
      return {
        address: obj.metaDataProperty.GeocoderMetaData.text,
        lat: coords[1],
        lng: coords[0],
      }
    })
  } catch { return [] }
}

// ── Компонент поля адреса с автодополнением ───────────────────
function AddressInput({
  label,
  placeholder,
  icon: Icon,
  onSelect,
  error,
}: {
  label: string
  placeholder: string
  icon: React.ElementType
  onSelect: (address: string, lat: number, lng: number) => void
  error?: string
}) {
  const [value, setValue]         = useState('')
  const [suggestions, setSuggestions] = useState<Array<{address: string, lat: number, lng: number}>>([])
  const [loading, setLoading]     = useState(false)
  const [open, setOpen]           = useState(false)
  const timer = useRef<NodeJS.Timeout>()

  async function handleChange(q: string) {
    setValue(q)
    clearTimeout(timer.current)
    if (q.length < 3) { setSuggestions([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      setLoading(true)
      const res = await suggestAddresses(q)
      setSuggestions(res)
      setOpen(res.length > 0)
      setLoading(false)
    }, 400)
  }

  function handleSelect(item: { address: string; lat: number; lng: number }) {
    setValue(item.address)
    setSuggestions([])
    setOpen(false)
    onSelect(item.address, item.lat, item.lng)
  }

  return (
    <div className="relative">
      <label className="label">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={value}
          onChange={e => handleChange(e.target.value)}
          placeholder={placeholder}
          className={`input pl-10 ${error ? 'input-error' : ''}`}
          autoComplete="off"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin rounded-full h-4 w-4 border-2 border-primary-400 border-t-transparent" />
        )}
      </div>
      {error && <p className="mt-1 text-xs text-danger-500">{error}</p>}

      {/* Выпадающий список адресов */}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-modal overflow-hidden">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => handleSelect(s)}
                className="w-full text-left px-4 py-3 text-sm hover:bg-primary-50 flex items-center gap-3 transition-colors"
              >
                <MapPin className="w-4 h-4 text-primary-400 flex-shrink-0" />
                <span className="truncate">{s.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Главный компонент ──────────────────────────────────────────
export default function NewRidePage() {
  const router = useRouter()
  const supabase = createClient()
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RideFormData>({
    resolver: zodResolver(rideSchema),
    defaultValues: {
      seats_needed:    1,
      allow_luggage:   false,
      allow_pets:      false,
      no_smoking:      false,
      ride_type:       'city',
      passenger_price: 0,
      origin_lat:      0,
      origin_lng:      0,
      dest_lat:        0,
      dest_lng:        0,
    },
  })

  const rideType = watch('ride_type')

  async function onSubmit(data: RideFormData) {
    if (!data.origin_lat || !data.dest_lat) {
      toast.error('Выберите адреса из подсказок')
      return
    }

    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    const { data: ride, error } = await supabase
      .from('rides')
      .insert({
        passenger_id:    user.id,
        origin_address:  data.origin_address,
        origin_lat:      data.origin_lat,
        origin_lng:      data.origin_lng,
        dest_address:    data.dest_address,
        dest_lat:        data.dest_lat,
        dest_lng:        data.dest_lng,
        passenger_price: data.passenger_price,
        seats_needed:    data.seats_needed,
        comment:         data.comment,
        allow_luggage:   data.allow_luggage,
        allow_pets:      data.allow_pets,
        no_smoking:      data.no_smoking,
        ride_type:       data.ride_type,
        status:          'searching',
      })
      .select()
      .single()

    setSubmitting(false)

    if (error) {
      toast.error('Ошибка создания заявки')
      return
    }

    toast.success('Заявка создана! Ищем водителей...')
    router.push(`/passenger/ride/${ride.id}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Шапка */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => router.back()} className="btn-ghost p-2 rounded-xl">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Новая заявка</h1>
        </div>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* Тип поездки */}
        <div className="card p-4">
          <p className="label mb-3">Тип поездки</p>
          <div className="grid grid-cols-2 gap-2">
            {(['city', 'intercity'] as const).map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setValue('ride_type', type)}
                className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                  rideType === type
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type === 'city' ? '🏙 По городу' : '🛣 Межгород'}
              </button>
            ))}
          </div>
        </div>

        {/* Маршрут */}
        <div className="card p-4 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpDown className="w-4 h-4 text-primary-500" />
            <p className="font-semibold text-gray-900">Маршрут</p>
          </div>

          <AddressInput
            label="Откуда"
            placeholder="Введите адрес отправления"
            icon={Navigation}
            onSelect={(addr, lat, lng) => {
              setValue('origin_address', addr)
              setValue('origin_lat', lat)
              setValue('origin_lng', lng)
            }}
            error={errors.origin_address?.message}
          />

          <AddressInput
            label="Куда"
            placeholder="Введите адрес назначения"
            icon={MapPin}
            onSelect={(addr, lat, lng) => {
              setValue('dest_address', addr)
              setValue('dest_lat', lat)
              setValue('dest_lng', lng)
            }}
            error={errors.dest_address?.message}
          />
        </div>

        {/* Цена и места */}
        <div className="card p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Ваша цена (₽)</label>
              <div className="relative">
                <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  {...register('passenger_price', { valueAsNumber: true })}
                  type="number"
                  min="1"
                  placeholder="500"
                  className={`input pl-10 ${errors.passenger_price ? 'input-error' : ''}`}
                />
              </div>
              {errors.passenger_price && (
                <p className="mt-1 text-xs text-danger-500">{errors.passenger_price.message}</p>
              )}
            </div>
            <div>
              <label className="label">Кол-во мест</label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  {...register('seats_needed', { valueAsNumber: true })}
                  type="number"
                  min="1"
                  max="8"
                  placeholder="1"
                  className="input pl-10"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Пожелания */}
        <div className="card p-4 space-y-3">
          <p className="font-semibold text-gray-900">Пожелания</p>

          {/* Чекбоксы */}
          {[
            { key: 'allow_luggage', icon: Luggage, label: 'Есть багаж' },
            { key: 'allow_pets',   icon: PawPrint, label: 'С животным' },
            { key: 'no_smoking',   icon: CigaretteOff, label: 'Не курящий салон' },
          ].map(({ key, icon: Icon, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer py-1">
              <input
                {...register(key as keyof RideFormData)}
                type="checkbox"
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <Icon className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}

          <div className="pt-2">
            <label className="label">Комментарий водителю</label>
            <div className="relative">
              <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <textarea
                {...register('comment')}
                rows={3}
                placeholder="Уточнения к поездке..."
                className="input pl-10 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Кнопка отправки */}
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary btn-lg w-full"
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Создаём заявку...
            </span>
          ) : (
            '📍 Создать заявку'
          )}
        </button>

        <p className="text-center text-xs text-gray-400 pb-4">
          Водители в радиусе 15 км увидят вашу заявку
        </p>
      </form>
    </div>
  )
}
