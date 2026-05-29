'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { ChevronLeft, Car } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  brand:        z.string().min(1, 'Укажите марку'),
  model:        z.string().min(1, 'Укажите модель'),
  year:         z.number().min(1990).max(new Date().getFullYear() + 1),
  color:        z.string().min(1, 'Укажите цвет'),
  plate_number: z.string().min(4, 'Укажите номер'),
  seats_count:  z.number().min(1).max(20),
})

type FormData = z.infer<typeof schema>

const COLORS = ['Белый','Чёрный','Серый','Серебристый','Синий','Красный','Зелёный','Жёлтый','Коричневый','Другой']

export default function NewVehiclePage() {
  const router   = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { seats_count: 4, year: new Date().getFullYear() },
  })

  const selectedColor = watch('color')

  async function onSubmit(data: FormData) {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    const { error } = await supabase.from('driver_vehicles').insert({
      driver_id:    user.id,
      brand:        data.brand.trim(),
      model:        data.model.trim(),
      year:         data.year,
      color:        data.color,
      plate_number: data.plate_number.trim().toUpperCase(),
      seats_count:  data.seats_count,
      is_active:    true,
    })
    setSaving(false)
    if (error) { toast.error('Ошибка сохранения'); return }
    toast.success('Автомобиль добавлен!')
    router.push('/profile')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="btn-ghost p-2 rounded-xl">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Добавить автомобиль</h1>
        </div>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg mx-auto px-4 py-5 space-y-4">

        <div className="card p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Марка *</label>
              <input {...register('brand')} placeholder="Toyota" className={`input ${errors.brand ? 'input-error' : ''}`} />
              {errors.brand && <p className="mt-1 text-xs text-rose-500">{errors.brand.message}</p>}
            </div>
            <div>
              <label className="label">Модель *</label>
              <input {...register('model')} placeholder="Camry" className={`input ${errors.model ? 'input-error' : ''}`} />
              {errors.model && <p className="mt-1 text-xs text-rose-500">{errors.model.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Год выпуска *</label>
              <input {...register('year', { valueAsNumber: true })} type="number" min={1990} max={2026} className="input" />
            </div>
            <div>
              <label className="label">Кол-во мест *</label>
              <input {...register('seats_count', { valueAsNumber: true })} type="number" min={1} max={20} className="input" />
            </div>
          </div>

          <div>
            <label className="label">Гос. номер *</label>
            <input
              {...register('plate_number')}
              placeholder="А123БВ777"
              className={`input uppercase ${errors.plate_number ? 'input-error' : ''}`}
            />
            {errors.plate_number && <p className="mt-1 text-xs text-rose-500">{errors.plate_number.message}</p>}
          </div>

          <div>
            <label className="label">Цвет *</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {COLORS.map(c => (
                <button
                  key={c} type="button"
                  onClick={() => setValue('color', c)}
                  className={`px-3 py-1.5 rounded-full text-sm border-2 transition-all ${
                    selectedColor === c
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >{c}</button>
              ))}
            </div>
            {errors.color && <p className="mt-1 text-xs text-rose-500">{errors.color.message}</p>}
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary btn-lg w-full">
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Сохраняем...
            </span>
          ) : (
            <span className="flex items-center gap-2"><Car className="w-5 h-5" /> Добавить автомобиль</span>
          )}
        </button>
      </form>
    </div>
  )
}
