'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { ChevronLeft, Car, Trash2, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { DriverVehicle } from '@/types'

const COLORS = ['Белый','Чёрный','Серый','Серебристый','Синий','Красный','Зелёный','Жёлтый','Коричневый','Другой']

export default function VehicleEditPage() {
  const router   = useRouter()
  const params   = useParams()
  const id       = params.id as string
  const supabase = createClient()

  const [vehicle, setVehicle] = useState<DriverVehicle | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [selectedColor, setSelectedColor] = useState('')

  const { register, handleSubmit, setValue, reset } = useForm()

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('driver_vehicles').select('*').eq('id', id).single()
      if (data) {
        setVehicle(data)
        setSelectedColor(data.color)
        reset(data)
      }
      setLoading(false)
    }
    load()
  }, [id])

  async function onSubmit(data: any) {
    setSaving(true)
    const { error } = await supabase.from('driver_vehicles').update({
      brand:        data.brand.trim(),
      model:        data.model.trim(),
      year:         Number(data.year),
      color:        selectedColor,
      plate_number: data.plate_number.trim().toUpperCase(),
      seats_count:  Number(data.seats_count),
    }).eq('id', id)
    setSaving(false)
    if (error) { toast.error('Ошибка сохранения'); return }
    toast.success('Автомобиль обновлён!')
    router.push('/profile')
  }

  async function deleteVehicle() {
    if (!confirm('Удалить автомобиль?')) return
    await supabase.from('driver_vehicles').update({ is_active: false }).eq('id', id)
    toast.success('Автомобиль удалён')
    router.push('/profile')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="btn-ghost p-2 rounded-xl">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">Редактировать авто</h1>
          </div>
          <button onClick={deleteVehicle} className="btn-ghost p-2 rounded-xl text-rose-500">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {vehicle?.is_verified && (
          <div className="flex items-center gap-2 bg-green-50 text-green-700 rounded-xl px-4 py-3 text-sm">
            <Shield className="w-4 h-4" />
            <span>Автомобиль верифицирован</span>
          </div>
        )}

        <div className="card p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Марка</label>
              <input {...register('brand')} className="input" />
            </div>
            <div>
              <label className="label">Модель</label>
              <input {...register('model')} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Год</label>
              <input {...register('year')} type="number" className="input" />
            </div>
            <div>
              <label className="label">Мест</label>
              <input {...register('seats_count')} type="number" className="input" />
            </div>
          </div>
          <div>
            <label className="label">Гос. номер</label>
            <input {...register('plate_number')} className="input uppercase" />
          </div>
          <div>
            <label className="label">Цвет</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setSelectedColor(c)}
                  className={`px-3 py-1.5 rounded-full text-sm border-2 transition-all ${
                    selectedColor === c
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >{c}</button>
              ))}
            </div>
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary btn-lg w-full">
          {saving ? 'Сохраняем...' : 'Сохранить изменения'}
        </button>
      </form>
    </div>
  )
}
