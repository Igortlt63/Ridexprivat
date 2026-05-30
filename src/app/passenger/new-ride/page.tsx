'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import {
  ChevronLeft, MapPin, Navigation, Luggage, PawPrint,
  CigaretteOff, Users, MessageSquare, Banknote, Map
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'

const YandexMap = dynamic(() => import('@/components/map/YandexMap'), { ssr: false })

const rideSchema = z.object({
  origin_address:  z.string().min(3, 'Выберите точку на карте или введите адрес'),
  origin_lat:      z.number(),
  origin_lng:      z.number(),
  dest_address:    z.string().min(3, 'Выберите точку назначения'),
  dest_lat:        z.number(),
  dest_lng:        z.number(),
  passenger_price: z.number().min(1, 'Укажите цену'),
  seats_needed:    z.number().min(1).max(8),
  comment:         z.string().max(300).optional().default(''),
  allow_luggage:   z.boolean().default(false),
  allow_pets:      z.boolean().default(false),
  no_smoking:      z.boolean().default(false),
  ride_type:       z.enum(['city', 'intercity']).default('city'),
})

type RideFormData = z.infer<typeof rideSchema>

// Шаги формы
type Step = 'origin' | 'dest' | 'details'

export default function NewRidePage() {
  const router   = useRouter()
  const supabase = createClient()
  const apiKey   = process.env.NEXT_PUBLIC_YANDEX_MAPS_KEY || ''

  const [step,       setStep]       = useState<Step>('origin')
  const [submitting, setSubmitting] = useState(false)

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<RideFormData>({
    resolver: zodResolver(rideSchema),
    defaultValues: {
      seats_needed: 1, allow_luggage: false, allow_pets: false,
      no_smoking: false, ride_type: 'city', passenger_price: 0,
      origin_lat: 0, origin_lng: 0, dest_lat: 0, dest_lng: 0,
    },
  })

  const watchAll = watch()

  function handleOriginPick(lat: number, lng: number, address: string) {
    setValue('origin_lat', lat)
    setValue('origin_lng', lng)
    setValue('origin_address', address)
    toast.success('Точка отправления выбрана')
  }

  function handleDestPick(lat: number, lng: number, address: string) {
    setValue('dest_lat', lat)
    setValue('dest_lng', lng)
    setValue('dest_address', address)
    toast.success('Точка назначения выбрана')
  }

  async function onSubmit(data: RideFormData) {
    if (!data.origin_lat || !data.dest_lat) {
      toast.error('Выберите оба адреса на карте')
      return
    }
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    const { data: ride, error } = await supabase.from('rides').insert({
      passenger_id:    user.id,
      origin_address:  data.origin_address,
      origin_lat:      data.origin_lat,
      origin_lng:      data.origin_lng,
      dest_address:    data.dest_address,
      dest_lat:        data.dest_lat,
      dest_lng:        data.dest_lng,
      passenger_price: data.passenger_price,
      seats_needed:    data.seats_needed,
      comment:         data.comment || null,
      allow_luggage:   data.allow_luggage,
      allow_pets:      data.allow_pets,
      no_smoking:      data.no_smoking,
      ride_type:       data.ride_type,
      status:          'searching',
    }).select().single()

    setSubmitting(false)
    if (error) { toast.error('Ошибка создания заявки'); return }
    toast.success('Заявка создана! Ищем водителей...')
    router.push(`/passenger/ride/${ride.id}`)
  }

  const hasOrigin = watchAll.origin_lat !== 0
  const hasDest   = watchAll.dest_lat   !== 0

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="btn-ghost p-2 rounded-xl">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Новая заявка</h1>
        </div>

        {/* Шаги */}
        <div className="max-w-lg mx-auto px-4 pb-3 flex gap-2">
          {[
            { key: 'origin',  label: '1. Откуда' },
            { key: 'dest',    label: '2. Куда' },
            { key: 'details', label: '3. Детали' },
          ].map(s => (
            <button key={s.key} onClick={() => setStep(s.key as Step)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                step === s.key
                  ? 'bg-indigo-600 text-white'
                  : (s.key === 'dest' && !hasOrigin) || (s.key === 'details' && !hasDest)
                  ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              disabled={(s.key === 'dest' && !hasOrigin) || (s.key === 'details' && !hasDest)}
            >{s.label}</button>
          ))}
        </div>
      </header>

      <div className="max-w-lg mx-auto">
        {/* Шаг 1 — выбор откуда */}
        {step === 'origin' && (
          <div>
            <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-indigo-600" />
                <p className="text-sm font-medium text-indigo-700">Нажмите на карту чтобы выбрать точку отправления</p>
              </div>
              {hasOrigin && (
                <p className="text-xs text-indigo-600 mt-1 truncate">✓ {watchAll.origin_address}</p>
              )}
            </div>
            <YandexMap
              mode="pick"
              apiKey={apiKey}
              onPick={handleOriginPick}
              pickLabel="Точка отправления"
              height="calc(100vh - 200px)"
            />
            {hasOrigin && (
              <div className="px-4 py-3">
                <button onClick={() => setStep('dest')} className="btn-primary btn-lg w-full">
                  Далее — выбрать куда →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Шаг 2 — выбор куда */}
        {step === 'dest' && (
          <div>
            <div className="px-4 py-3 bg-rose-50 border-b border-rose-100">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-600" />
                <p className="text-sm font-medium text-rose-700">Нажмите на карту чтобы выбрать точку назначения</p>
              </div>
              {hasDest && (
                <p className="text-xs text-rose-600 mt-1 truncate">✓ {watchAll.dest_address}</p>
              )}
            </div>
            <YandexMap
              mode="pick"
              apiKey={apiKey}
              onPick={handleDestPick}
              pickLabel="Точка назначения"
              height="calc(100vh - 200px)"
            />
            {hasDest && (
              <div className="px-4 py-3 space-y-2">
                {/* Превью маршрута */}
                <div className="card p-3 flex items-center gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                      <span className="truncate">{watchAll.origin_address}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <div className="w-2 h-2 bg-rose-500 rounded-full flex-shrink-0" />
                      <span className="truncate">{watchAll.dest_address}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setStep('details')} className="btn-primary btn-lg w-full">
                  Далее — детали поездки →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Шаг 3 — детали */}
        {step === 'details' && (
          <form onSubmit={handleSubmit(onSubmit)} className="px-4 py-4 space-y-4 pb-10">

            {/* Мини карта маршрута */}
            {hasOrigin && hasDest && (
              <YandexMap
                mode="route"
                apiKey={apiKey}
                originLat={watchAll.origin_lat}
                originLng={watchAll.origin_lng}
                destLat={watchAll.dest_lat}
                destLng={watchAll.dest_lng}
                height="200px"
              />
            )}

            {/* Маршрут */}
            <div className="card p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <div className="w-2.5 h-2.5 bg-green-500 rounded-full flex-shrink-0" />
                <span className="truncate">{watchAll.origin_address}</span>
              </div>
              <div className="ml-1 w-px h-4 bg-gray-200 ml-1" />
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <div className="w-2.5 h-2.5 bg-rose-500 rounded-full flex-shrink-0" />
                <span className="truncate">{watchAll.dest_address}</span>
              </div>
              <button type="button" onClick={() => setStep('origin')}
                className="text-xs text-indigo-600 hover:underline mt-1">
                Изменить маршрут
              </button>
            </div>

            {/* Тип поездки */}
            <div className="card p-4">
              <p className="label">Тип поездки</p>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {[{v:'city',l:'🏙 По городу'},{v:'intercity',l:'🛣 Межгород'}].map(t => (
                  <button key={t.v} type="button"
                    onClick={() => setValue('ride_type', t.v as any)}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                      watchAll.ride_type === t.v
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >{t.l}</button>
                ))}
              </div>
            </div>

            {/* Цена и места */}
            <div className="card p-4 grid grid-cols-2 gap-4">
              <div>
                <label className="label">Ваша цена (₽)</label>
                <div className="relative">
                  <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    {...register('passenger_price', { valueAsNumber: true })}
                    type="number" min="1" placeholder="500"
                    className={`input pl-10 ${errors.passenger_price ? 'input-error' : ''}`}
                  />
                </div>
                {errors.passenger_price && <p className="mt-1 text-xs text-rose-500">{errors.passenger_price.message}</p>}
              </div>
              <div>
                <label className="label">Кол-во мест</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    {...register('seats_needed', { valueAsNumber: true })}
                    type="number" min="1" max="8" placeholder="1"
                    className="input pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Пожелания */}
            <div className="card p-4 space-y-3">
              <p className="font-semibold text-gray-900">Пожелания</p>
              {[
                { key: 'allow_luggage', Icon: Luggage,      label: 'Есть багаж' },
                { key: 'allow_pets',    Icon: PawPrint,     label: 'С животным' },
                { key: 'no_smoking',    Icon: CigaretteOff, label: 'Не курящий салон' },
              ].map(({ key, Icon, label }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <input {...register(key as any)} type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600" />
                  <Icon className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
              <div>
                <label className="label">Комментарий водителю</label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <textarea {...register('comment')} rows={2}
                    placeholder="Уточнения к поездке..." className="input pl-10 resize-none" />
                </div>
              </div>
            </div>

            <button type="submit" disabled={submitting} className="btn-primary btn-lg w-full">
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Создаём заявку...
                </span>
              ) : '📍 Создать заявку'}
            </button>
            <p className="text-center text-xs text-gray-400 pb-4">Водители в радиусе 15 км увидят вашу заявку</p>
          </form>
        )}
      </div>
    </div>
  )
}
