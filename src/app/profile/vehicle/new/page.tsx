'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ChevronLeft, Car } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const COLORS = ['Белый','Чёрный','Серый','Серебристый','Синий','Красный','Зелёный','Жёлтый','Коричневый','Другой']

export default function NewVehiclePage() {
  const router   = useRouter()
  const supabase = createClient()

  const [brand,       setBrand]       = useState('')
  const [model,       setModel]       = useState('')
  const [year,        setYear]        = useState(String(new Date().getFullYear()))
  const [color,       setColor]       = useState('')
  const [plate,       setPlate]       = useState('')
  const [seats,       setSeats]       = useState('4')
  const [saving,      setSaving]      = useState(false)
  const [errors,      setErrors]      = useState<Record<string,string>>({})

  function validate() {
    const e: Record<string,string> = {}
    if (!brand.trim())    e.brand  = 'Укажите марку'
    if (!model.trim())    e.model  = 'Укажите модель'
    if (!color)           e.color  = 'Выберите цвет'
    if (!plate.trim())    e.plate  = 'Укажите номер'
    if (!year || Number(year) < 1990) e.year = 'Укажите год'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function onSubmit() {
    if (!validate()) { toast.error('Заполните обязательные поля'); return }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    const { error } = await supabase.from('driver_vehicles').insert({
      driver_id:    user.id,
      brand:        brand.trim(),
      model:        model.trim(),
      year:         Number(year),
      color,
      plate_number: plate.trim().toUpperCase(),
      seats_count:  Number(seats),
      is_active:    true,
    })

    setSaving(false)

    if (error) {
      console.error('Vehicle error:', error)
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

        <div className="card p-4 space-y-4">
          {/* Марка и модель */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Марка <span className="text-rose-500">*</span></label>
              <input
                type="text"
                value={brand}
                onChange={e => setBrand(e.target.value)}
                placeholder="Toyota"
                className={`input ${errors.brand ? 'input-error' : ''}`}
              />
              {errors.brand && <p className="mt-1 text-xs text-rose-500">{errors.brand}</p>}
            </div>
            <div>
              <label className="label">Модель <span className="text-rose-500">*</span></label>
              <input
                type="text"
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="Camry"
                className={`input ${errors.model ? 'input-error' : ''}`}
              />
              {errors.model && <p className="mt-1 text-xs text-rose-500">{errors.model}</p>}
            </div>
          </div>

          {/* Год и места */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Год выпуска <span className="text-rose-500">*</span></label>
              <input
                type="number"
                value={year}
                onChange={e => setYear(e.target.value)}
                min={1990}
                max={2026}
                placeholder="2020"
                className={`input ${errors.year ? 'input-error' : ''}`}
              />
              {errors.year && <p className="mt-1 text-xs text-rose-500">{errors.year}</p>}
            </div>
            <div>
              <label className="label">Количество мест</label>
              <select
                value={seats}
                onChange={e => setSeats(e.target.value)}
                className="input"
              >
                {[2,3,4,5,6,7,8].map(n => (
                  <option key={n} value={n}>{n} места</option>
                ))}
              </select>
            </div>
          </div>

          {/* Госномер */}
          <div>
            <label className="label">Гос. номер <span className="text-rose-500">*</span></label>
            <input
              type="text"
              value={plate}
              onChange={e => setPlate(e.target.value.toUpperCase())}
              placeholder="А123БВ777"
              className={`input uppercase tracking-widest ${errors.plate ? 'input-error' : ''}`}
            />
            {errors.plate && <p className="mt-1 text-xs text-rose-500">{errors.plate}</p>}
          </div>

          {/* Цвет */}
          <div>
            <label className="label">Цвет <span className="text-rose-500">*</span></label>
            <div className="flex flex-wrap gap-2 mt-1">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setColor(c); setErrors(e => ({...e, color: ''})) }}
                  className={`px-3 py-1.5 rounded-full text-sm border-2 transition-all ${
                    color === c
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:border-indigo-200'
                  }`}
                >{c}</button>
              ))}
            </div>
            {errors.color && <p className="mt-1 text-xs text-rose-500">{errors.color}</p>}
          </div>
        </div>

        <button type="button" onClick={onSubmit} disabled={saving} className="btn-primary btn-lg w-full">
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Сохраняем...
            </span>
          ) : (
            <span className="flex items-center gap-2"><Car className="w-5 h-5" /> Добавить автомобиль</span>
          )}
        </button>
      </div>
    </div>
  )
}
