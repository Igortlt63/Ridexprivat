'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ChevronLeft, Car, Camera, X, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { BRAND_LIST, getModels } from '@/lib/cars'

const COLORS = ['Белый','Чёрный','Серый','Серебристый','Синий','Красный','Зелёный','Жёлтый','Коричневый','Оранжевый','Другой']

export default function NewVehiclePage() {
  const router   = useRouter()
  const supabase = createClient()
  const fileRef  = useRef<HTMLInputElement>(null)

  const [brand,    setBrand]    = useState('')
  const [model,    setModel]    = useState('')
  const [year,     setYear]     = useState(String(new Date().getFullYear()))
  const [color,    setColor]    = useState('')
  const [plate,    setPlate]    = useState('')
  const [seats,    setSeats]    = useState('4')
  const [photo,    setPhoto]    = useState<File | null>(null)
  const [preview,  setPreview]  = useState('')
  const [saving,   setSaving]   = useState(false)
  const [errors,   setErrors]   = useState<Record<string,string>>({})

  // Список моделей для выбранной марки
  const models = brand ? getModels(brand) : []

  function validate() {
    const e: Record<string,string> = {}
    if (!brand)           e.brand = 'Выберите марку'
    if (!model)           e.model = 'Выберите модель'
    if (!color)           e.color = 'Выберите цвет'
    if (!plate.trim())    e.plate = 'Укажите номер'
    if (!year || Number(year) < 1970 || Number(year) > new Date().getFullYear() + 1)
                          e.year  = 'Укажите корректный год'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Фото не более 5 МБ'); return }
    setPhoto(file)
    setPreview(URL.createObjectURL(file))
  }

  async function onSubmit() {
    if (!validate()) { toast.error('Заполните обязательные поля'); return }
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    // Загружаем фото если есть
    let photoUrl: string | null = null
    if (photo) {
      const ext  = photo.name.split('.').pop()
      const path = `vehicles/${user.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, photo, { upsert: true })
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
        photoUrl = publicUrl
      }
    }

    const { error } = await supabase.from('driver_vehicles').insert({
      driver_id:    user.id,
      brand:        brand.trim(),
      model:        model.trim(),
      year:         Number(year),
      color,
      plate_number: plate.trim().toUpperCase(),
      seats_count:  Number(seats),
      is_active:    true,
      // Фото сохраняем как JSON в поле которое добавим через SQL
      // Пока через notes — или можно добавить колонку photo_url
    })

    // Если поле photo_url есть — обновим
    if (!error && photoUrl) {
      await supabase.from('driver_vehicles')
        .update({ photo_url: photoUrl } as any)
        .eq('driver_id', user.id)
        .eq('plate_number', plate.trim().toUpperCase())
    }

    setSaving(false)
    if (error) {
      console.error(error)
      toast.error('Ошибка: ' + error.message)
      return
    }
    toast.success('Автомобиль добавлен!')
    router.push('/profile')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="btn-ghost p-2 rounded-xl">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">Добавить автомобиль</h1>
          </div>
          <button onClick={onSubmit} disabled={saving} className="btn-primary btn-sm">
            {saving ? '...' : 'Сохранить'}
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4 pb-10">

        {/* Фото автомобиля */}
        <div className="card p-4">
          <p className="font-semibold text-gray-900 mb-3">Фото автомобиля</p>
          <div className="flex items-center gap-4">
            {preview ? (
              <div className="relative w-24 h-24 flex-shrink-0">
                <img src={preview} alt="" className="w-24 h-24 rounded-xl object-cover" />
                <button
                  type="button"
                  onClick={() => { setPhoto(null); setPreview('') }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 hover:border-indigo-400 transition-colors flex-shrink-0"
              >
                <Camera className="w-6 h-6 text-gray-400" />
                <span className="text-xs text-gray-400">Фото</span>
              </button>
            )}
            <div className="text-sm text-gray-500">
              <p className="font-medium text-gray-700">Добавьте фото авто</p>
              <p className="text-xs mt-1 text-gray-400">Пассажиры увидят его в предложениях</p>
              <p className="text-xs text-gray-400">JPG, PNG до 5 МБ</p>
              {!preview && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mt-2 text-indigo-600 text-xs font-medium hover:underline"
                >
                  Выбрать фото →
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </div>
        </div>

        {/* Марка и Модель */}
        <div className="card p-4 space-y-4">
          <p className="font-semibold text-gray-900">Марка и модель</p>

          {/* Марка */}
          <div>
            <label className="label">Марка <span className="text-rose-500">*</span></label>
            <div className="relative">
              <select
                value={brand}
                onChange={e => { setBrand(e.target.value); setModel(''); setErrors(er => ({...er, brand:''})) }}
                className={`input appearance-none pr-10 ${errors.brand ? 'input-error' : ''}`}
              >
                <option value="">Выберите марку...</option>
                {BRAND_LIST.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            {errors.brand && <p className="mt-1 text-xs text-rose-500">{errors.brand}</p>}
          </div>

          {/* Модель */}
          <div>
            <label className="label">Модель <span className="text-rose-500">*</span></label>
            <div className="relative">
              <select
                value={model}
                onChange={e => { setModel(e.target.value); setErrors(er => ({...er, model:''})) }}
                disabled={!brand}
                className={`input appearance-none pr-10 disabled:bg-gray-100 disabled:text-gray-400 ${errors.model ? 'input-error' : ''}`}
              >
                <option value="">{brand ? 'Выберите модель...' : 'Сначала выберите марку'}</option>
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            {errors.model && <p className="mt-1 text-xs text-rose-500">{errors.model}</p>}
          </div>
        </div>

        {/* Год, места, номер */}
        <div className="card p-4 space-y-4">
          <p className="font-semibold text-gray-900">Характеристики</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Год выпуска <span className="text-rose-500">*</span></label>
              <select
                value={year}
                onChange={e => setYear(e.target.value)}
                className="input appearance-none"
              >
                {Array.from({ length: new Date().getFullYear() - 1969 }, (_, i) => {
                  const y = new Date().getFullYear() - i
                  return <option key={y} value={y}>{y}</option>
                })}
              </select>
            </div>
            <div>
              <label className="label">Количество мест</label>
              <select value={seats} onChange={e => setSeats(e.target.value)} className="input appearance-none">
                {[2,3,4,5,6,7,8,9,10,12,15,18,20].map(n => (
                  <option key={n} value={n}>{n} {n === 4 ? '(стандарт)' : ''}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Гос. номер <span className="text-rose-500">*</span></label>
            <input
              type="text"
              value={plate}
              onChange={e => setPlate(e.target.value.toUpperCase())}
              placeholder="А123БВ777"
              maxLength={9}
              className={`input uppercase tracking-widest font-mono text-lg ${errors.plate ? 'input-error' : ''}`}
            />
            {errors.plate && <p className="mt-1 text-xs text-rose-500">{errors.plate}</p>}
          </div>
        </div>

        {/* Цвет */}
        <div className="card p-4">
          <p className="font-semibold text-gray-900 mb-3">Цвет <span className="text-rose-500">*</span></p>
          <div className="flex flex-wrap gap-2">
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => { setColor(c); setErrors(er => ({...er, color:''})) }}
                className={`px-3 py-1.5 rounded-full text-sm border-2 transition-all ${
                  color === c
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                    : 'border-gray-200 text-gray-600 hover:border-indigo-200'
                }`}
              >{c}</button>
            ))}
          </div>
          {errors.color && <p className="mt-2 text-xs text-rose-500">{errors.color}</p>}
        </div>

        <button type="button" onClick={onSubmit} disabled={saving} className="btn-primary btn-lg w-full">
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Сохраняем...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Car className="w-5 h-5" /> Добавить автомобиль
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
