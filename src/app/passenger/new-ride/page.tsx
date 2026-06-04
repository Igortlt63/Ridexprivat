'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { z } from 'zod'
import {
  ChevronLeft, MapPin, Navigation, Luggage, PawPrint,
  CigaretteOff, Users, MessageSquare, Banknote, Crosshair
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { shortenAddress } from '@/lib/address'
import dynamic from 'next/dynamic'

const YandexMap = dynamic(() => import('@/components/map/YandexMap'), { ssr: false })

type Step = 'origin' | 'dest' | 'details'

// ── Zod-схема для шага «Детали» ───────────────────────────────
const detailsSchema = z.object({
  price:   z.number({ invalid_type_error: 'Укажите цену' })
             .min(1, 'Минимальная цена — 1 ₽')
             .max(999_999, 'Максимальная цена — 999 999 ₽'),
  seats:   z.number().min(1).max(8),
  comment: z.string().max(500, 'Максимум 500 символов').optional(),
})

// Геокодирование через Яндекс
async function geocodeAddress(query: string, apiKey: string) {
  try {
    const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${apiKey}&geocode=${encodeURIComponent(query)}&results=5&format=json&lang=ru_RU`
    const res  = await fetch(url)
    const json = await res.json()
    const members = json?.response?.GeoObjectCollection?.featureMember || []
    return members.map((m: any) => {
      const obj    = m.GeoObject
      const coords = obj.Point.pos.split(' ').map(Number)
      return {
        address: shortenAddress(obj.metaDataProperty.GeocoderMetaData.text),
        lat: coords[1],
        lng: coords[0],
      }
    })
  } catch { return [] }
}

// Обратное геокодирование — координаты → адрес
async function reverseGeocode(lat: number, lng: number, apiKey: string) {
  if (!apiKey || apiKey === 'undefined') return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  try {
    const url  = `https://geocode-maps.yandex.ru/1.x/?apikey=${apiKey}&geocode=${lng},${lat}&results=1&format=json&lang=ru_RU`
    const res  = await fetch(url)
    if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    const json = await res.json()
    const obj  = json?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject
    const addr = obj?.metaDataProperty?.GeocoderMetaData?.text
    return addr || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  } catch { return `${lat.toFixed(5)}, ${lng.toFixed(5)}` }
}

// Компонент поля адреса с автодополнением
function AddressInput({
  label, placeholder, icon: Icon, value, onChange, onSelect, color
}: {
  label: string
  placeholder: string
  icon: React.ElementType
  value: string
  onChange: (v: string) => void
  onSelect: (address: string, lat: number, lng: number) => void
  color: string
}) {
  const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_KEY || ''
  const [suggestions, setSuggestions] = useState<Array<{address: string; lat: number; lng: number}>>([])
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const timer = useRef<NodeJS.Timeout>()

  async function handleChange(q: string) {
    onChange(q)
    clearTimeout(timer.current)
    if (q.length < 3) { setSuggestions([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      setLoading(true)
      const res = await geocodeAddress(q, apiKey)
      setSuggestions(res)
      setOpen(res.length > 0)
      setLoading(false)
    }, 400)
  }

  function select(item: { address: string; lat: number; lng: number }) {
    onChange(item.address)
    setSuggestions([])
    setOpen(false)
    onSelect(item.address, item.lat, item.lng)
  }

  return (
    <div className="relative">
      <label className="label">{label}</label>
      <div className="relative">
        <Icon className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${color}`} />
        <input
          type="text"
          value={value}
          onChange={e => handleChange(e.target.value)}
          placeholder={placeholder}
          className="input pl-10 pr-10"
          autoComplete="off"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin rounded-full h-4 w-4 border-2 border-indigo-400 border-t-transparent" />
        )}
      </div>
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => select(s)}
                className="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 flex items-center gap-3 transition-colors"
              >
                <MapPin className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <span className="truncate">{s.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function NewRidePage() {
  const router   = useRouter()
  const supabase = createClient()
  const apiKey   = process.env.NEXT_PUBLIC_YANDEX_MAPS_KEY || ''

  const [step, setStep] = useState<Step>('origin')

  // Данные маршрута
  const [originAddress, setOriginAddress] = useState('')
  const [originLat,     setOriginLat]     = useState(0)
  const [originLng,     setOriginLng]     = useState(0)
  const [destAddress,   setDestAddress]   = useState('')
  const [destLat,       setDestLat]       = useState(0)
  const [destLng,       setDestLng]       = useState(0)

  // Детали
  const [price,       setPrice]       = useState('')
  const [seats,       setSeats]       = useState('1')
  const [rideType,    setRideType]    = useState<'city'|'intercity'>('city')
  const [comment,     setComment]     = useState('')
  const [luggage,     setLuggage]     = useState(false)
  const [pets,        setPets]        = useState(false)
  const [noSmoking,   setNoSmoking]   = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [geoLoading,  setGeoLoading]  = useState(false)

  // Режим карты vs ручной ввод
  const [mapMode, setMapMode] = useState(true)

  const hasOrigin = originLat !== 0
  const hasDest   = destLat   !== 0

  function handleOriginPick(lat: number, lng: number, address: string) {
    setOriginLat(lat); setOriginLng(lng); setOriginAddress(address)
    toast.success('Точка отправления выбрана')
  }

  function handleDestPick(lat: number, lng: number, address: string) {
    setDestLat(lat); setDestLng(lng); setDestAddress(address)
    toast.success('Точка назначения выбрана')
  }

  // Определить моё местоположение
  async function detectMyLocation() {
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        const address = shortenAddress(await reverseGeocode(lat, lng, apiKey))
        setOriginLat(lat); setOriginLng(lng); setOriginAddress(address)
        toast.success('Местоположение определено')
        setGeoLoading(false)
      },
      err => {
        console.error('Geo error:', err)
        toast.error('Не удалось определить местоположение. Введите адрес вручную.')
        setMapMode(false)
        setGeoLoading(false)
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  async function onSubmit() {
    if (!hasOrigin || !hasDest) { toast.error('Укажите маршрут'); return }

    // Zod-валидация деталей поездки
    const parsed = detailsSchema.safeParse({
      price:   Number(price),
      seats:   Number(seats),
      comment: comment || undefined,
    })
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message || 'Проверьте введённые данные'
      toast.error(msg)
      return
    }

    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    const { data: ride, error } = await supabase.from('rides').insert({
      passenger_id:    user.id,
      origin_address:  originAddress,
      origin_lat:      originLat,
      origin_lng:      originLng,
      dest_address:    destAddress,
      dest_lat:        destLat,
      dest_lng:        destLng,
      passenger_price: Number(price),
      seats_needed:    Number(seats),
      comment:         comment.trim() || null,
      allow_luggage:   luggage,
      allow_pets:      pets,
      no_smoking:      noSmoking,
      ride_type:       rideType,
      status:          'searching',
    }).select().single()

    setSubmitting(false)
    if (error) { console.error(error); toast.error('Ошибка создания заявки'); return }
    toast.success('Заявка создана! Ищем водителей...')
    router.replace(`/passenger/ride/${ride.id}`)
  }

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
          {([
            { key: 'origin',  label: '1. Откуда' },
            { key: 'dest',    label: '2. Куда' },
            { key: 'details', label: '3. Детали' },
          ] as const).map(s => (
            <button
              key={s.key}
              onClick={() => {
                if (s.key === 'dest' && !hasOrigin) return
                if (s.key === 'details' && !hasDest) return
                setStep(s.key)
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                step === s.key ? 'bg-indigo-600 text-white'
                : (s.key === 'dest' && !hasOrigin) || (s.key === 'details' && !hasDest)
                ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                : 'bg-gray-100 text-gray-600 hover:bg-indigo-50'
              }`}
            >{s.label}</button>
          ))}
        </div>
      </header>

      <div className="max-w-lg mx-auto">

        {/* ШАГ 1 — Откуда */}
        {step === 'origin' && (
          <div>
            {/* Переключатель карта/текст */}
            <div className="flex gap-2 px-4 pt-3">
              <button onClick={() => setMapMode(true)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${mapMode ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
                На карте
              </button>
              <button onClick={() => setMapMode(false)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${!mapMode ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
                Вручную
              </button>
            </div>

            {mapMode ? (
              <>
                <div className="px-4 py-2.5 bg-blue-50 mx-4 mt-3 rounded-xl">
                  <p className="text-sm text-blue-700 font-medium">Нажмите на карту — откуда ехать</p>
                  {hasOrigin && <p className="text-xs text-blue-600 mt-0.5 truncate">✓ {originAddress}</p>}
                </div>
                <div className="px-4 mt-2">
                  <button onClick={detectMyLocation} disabled={geoLoading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors mb-2">
                    {geoLoading
                      ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-400 border-t-transparent" />
                      : <Crosshair className="w-4 h-4 text-indigo-500" />
                    }
                    {geoLoading ? 'Определяем...' : 'Моё местоположение'}
                  </button>
                </div>
                <YandexMap mode="pick" apiKey={apiKey} onPick={handleOriginPick}
                  pickLabel="Откуда" height="calc(100vh - 290px)" />
              </>
            ) : (
              <div className="px-4 pt-4 space-y-3">
                <AddressInput
                  label="Адрес отправления"
                  placeholder="Начните вводить адрес..."
                  icon={Navigation}
                  value={originAddress}
                  onChange={setOriginAddress}
                  onSelect={(a,lat,lng) => { setOriginAddress(a); setOriginLat(lat); setOriginLng(lng) }}
                  color="text-green-500"
                />
                <button onClick={detectMyLocation} disabled={geoLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-50 rounded-xl text-sm text-indigo-600 hover:bg-indigo-100 transition-colors">
                  {geoLoading
                    ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-400 border-t-transparent" />
                    : <Crosshair className="w-4 h-4" />
                  }
                  {geoLoading ? 'Определяем...' : 'Определить автоматически'}
                </button>
              </div>
            )}

            {hasOrigin && (
              <div className="px-4 py-3">
                <button onClick={() => setStep('dest')} className="btn-primary btn-lg w-full">
                  Далее — куда ехать →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ШАГ 2 — Куда */}
        {step === 'dest' && (
          <div>
            <div className="flex gap-2 px-4 pt-3">
              <button onClick={() => setMapMode(true)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${mapMode ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
                На карте
              </button>
              <button onClick={() => setMapMode(false)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${!mapMode ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
                Вручную
              </button>
            </div>

            {mapMode ? (
              <>
                <div className="px-4 py-2.5 bg-rose-50 mx-4 mt-3 rounded-xl">
                  <p className="text-sm text-rose-700 font-medium">Нажмите на карту — куда ехать</p>
                  {hasDest && <p className="text-xs text-rose-600 mt-0.5 truncate">✓ {destAddress}</p>}
                </div>
                <YandexMap mode="pick" apiKey={apiKey} onPick={handleDestPick}
                  pickLabel="Куда" height="calc(100vh - 260px)" />
              </>
            ) : (
              <div className="px-4 pt-4">
                <AddressInput
                  label="Адрес назначения"
                  placeholder="Начните вводить адрес..."
                  icon={MapPin}
                  value={destAddress}
                  onChange={setDestAddress}
                  onSelect={(a,lat,lng) => { setDestAddress(a); setDestLat(lat); setDestLng(lng) }}
                  color="text-rose-500"
                />
              </div>
            )}

            {hasDest && (
              <div className="px-4 py-3 space-y-2">
                <div className="card p-3">
                  <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="truncate">{originAddress}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <div className="w-2 h-2 bg-rose-500 rounded-full" />
                    <span className="truncate">{destAddress}</span>
                  </div>
                </div>
                <button onClick={() => setStep('details')} className="btn-primary btn-lg w-full">
                  Далее — детали →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ШАГ 3 — Детали */}
        {step === 'details' && (
          <div className="px-4 py-4 space-y-4 pb-10">
            {/* Мини-карта маршрута */}
            {hasOrigin && hasDest && (
              <YandexMap mode="route" apiKey={apiKey}
                originLat={originLat} originLng={originLng}
                destLat={destLat} destLng={destLng}
                height="180px" />
            )}

            {/* Маршрут */}
            <div className="card p-4">
              <div className="space-y-2 mb-2">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                  <span className="truncate">{originAddress}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="w-2 h-2 bg-rose-500 rounded-full flex-shrink-0" />
                  <span className="truncate">{destAddress}</span>
                </div>
              </div>
              <button onClick={() => setStep('origin')} className="text-xs text-indigo-600 hover:underline">
                Изменить маршрут
              </button>
            </div>

            {/* Тип */}
            <div className="card p-4">
              <p className="label mb-2">Тип поездки</p>
              <div className="grid grid-cols-2 gap-2">
                {([{v:'city',l:'🏙 По городу'},{v:'intercity',l:'🛣 Межгород'}] as const).map(t => (
                  <button key={t.v} type="button" onClick={() => setRideType(t.v)}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                      rideType === t.v ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>{t.l}</button>
                ))}
              </div>
            </div>

            {/* Цена и места */}
            <div className="card p-4 grid grid-cols-2 gap-4">
              <div>
                <label className="label">Цена (₽) <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="number" value={price} onChange={e => setPrice(e.target.value)}
                    min="1" placeholder="500" className="input pl-10" />
                </div>
              </div>
              <div>
                <label className="label">Мест</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select value={seats} onChange={e => setSeats(e.target.value)} className="input pl-10">
                    {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Пожелания */}
            <div className="card p-4 space-y-3">
              <p className="font-semibold text-gray-900">Пожелания</p>
              {[
                { state: luggage,   setter: setLuggage,   Icon: Luggage,      label: 'Есть багаж' },
                { state: pets,      setter: setPets,       Icon: PawPrint,     label: 'С животным' },
                { state: noSmoking, setter: setNoSmoking,  Icon: CigaretteOff, label: 'Не курящий салон' },
              ].map(({ state, setter, Icon, label }) => (
                <label key={label} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={state} onChange={e => setter(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600" />
                  <Icon className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
              <div>
                <label className="label">Комментарий водителю</label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <textarea value={comment} onChange={e => setComment(e.target.value)}
                    rows={2} placeholder="Уточнения к поездке..." className="input pl-10 resize-none" />
                </div>
              </div>
            </div>

            <button type="button" onClick={onSubmit} disabled={submitting} className="btn-primary btn-lg w-full">
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Создаём заявку...
                </span>
              ) : '📍 Создать заявку'}
            </button>
            <p className="text-center text-xs text-gray-400">Водители в радиусе 15 км увидят заявку</p>
          </div>
        )}
      </div>
    </div>
  )
}