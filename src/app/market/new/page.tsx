'use client'

// src/app/market/new/page.tsx
// Форма создания нового объявления

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { ChevronLeft, Camera, X, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { MarketCategory } from '@/types'

const listingSchema = z.object({
  category_id:   z.number({ required_error: 'Выберите категорию' }).min(1),
  title:         z.string().min(5, 'Минимум 5 символов').max(150),
  description:   z.string().max(2000).optional().default(''),
  price:         z.number().nullable().optional(),
  price_type:    z.enum(['fixed', 'negotiable', 'free', 'per_hour', 'per_day']).default('fixed'),
  city:          z.string().min(2, 'Укажите город').max(100),
  address:       z.string().max(200).optional().default(''),
  contact_phone: z.string().min(10, 'Введите телефон'),
  contact_name:  z.string().min(2, 'Введите имя'),
})

type ListingFormData = z.infer<typeof listingSchema>

const PRICE_TYPE_OPTIONS = [
  { value: 'fixed',      label: 'Фиксированная' },
  { value: 'negotiable', label: 'Договорная' },
  { value: 'free',       label: 'Бесплатно' },
  { value: 'per_hour',   label: 'За час' },
  { value: 'per_day',    label: 'За день' },
]

const CATEGORY_ICONS: Record<string, string> = {
  services: '🔧', real_estate: '🏠', cargo: '🚛', special_tech: '🚜',
  hotels: '🏨', cars_sale: '🚗', cars_rent: '🔑', spare_parts: '⚙️',
  wheels: '🛞', car_wash: '💦', car_service: '🔩',
}

export default function NewListingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [categories, setCategories] = useState<MarketCategory[]>([])
  const [images, setImages]         = useState<File[]>([])
  const [previews, setPreviews]     = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const {
    register, handleSubmit, watch, setValue,
    formState: { errors },
  } = useForm<ListingFormData>({
    resolver: zodResolver(listingSchema),
    defaultValues: { price_type: 'fixed' },
  })

  const priceType   = watch('price_type')
  const categoryId  = watch('category_id')

  useEffect(() => {
    supabase.from('market_categories').select('*').order('sort_order')
      .then(({ data }) => setCategories(data || []))

    // Автозаполнение телефона из профиля
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: prof } = await supabase.from('profiles').select('phone,full_name').eq('id', user.id).single()
      if (prof?.phone) setValue('contact_phone', prof.phone)
      if (prof?.full_name) setValue('contact_name', prof.full_name)
    })
  }, [])

  // Добавление фото
  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (images.length + files.length > 8) {
      toast.error('Максимум 8 фотографий')
      return
    }
    const newFiles = [...images, ...files]
    setImages(newFiles)
    const newPreviews = newFiles.map(f => URL.createObjectURL(f))
    setPreviews(newPreviews)
  }

  function removeImage(idx: number) {
    const newFiles = images.filter((_, i) => i !== idx)
    setImages(newFiles)
    setPreviews(newFiles.map(f => URL.createObjectURL(f)))
  }

  async function onSubmit(data: ListingFormData) {
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    // Загружаем фото в Supabase Storage
    const uploadedUrls: string[] = []
    for (const file of images) {
      const ext  = file.name.split('.').pop()
      const path = `listings/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { data: uploaded, error } = await supabase.storage.from('market').upload(path, file)
      if (!error && uploaded) {
        const { data: { publicUrl } } = supabase.storage.from('market').getPublicUrl(path)
        uploadedUrls.push(publicUrl)
      }
    }

    const { data: listing, error } = await supabase.from('market_listings').insert({
      author_id:     user.id,
      category_id:   data.category_id,
      title:         data.title.trim(),
      description:   data.description?.trim() || null,
      price:         data.price_type === 'free' ? null : (data.price || null),
      price_type:    data.price_type,
      city:          data.city.trim(),
      address:       data.address?.trim() || null,
      contact_phone: data.contact_phone.trim(),
      contact_name:  data.contact_name.trim(),
      images:        uploadedUrls,
      status:        'active',
    }).select().single()

    setSubmitting(false)

    if (error) { toast.error('Ошибка создания объявления'); return }
    toast.success('Объявление опубликовано!')
    router.push(`/market/${listing.id}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="btn-ghost p-2 rounded-xl">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Новое объявление</h1>
        </div>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg mx-auto px-4 py-5 space-y-4 pb-10">

        {/* Выбор категории */}
        <div className="card p-4">
          <p className="font-semibold text-gray-900 mb-3">Категория *</p>
          <div className="grid grid-cols-3 gap-2">
            {categories.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setValue('category_id', cat.id)}
                className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 text-center transition-all ${
                  categoryId === cat.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <span className="text-xl">{CATEGORY_ICONS[cat.slug] || '📦'}</span>
                <span className="text-xs font-medium text-gray-700 leading-tight">{cat.name}</span>
              </button>
            ))}
          </div>
          {errors.category_id && (
            <p className="mt-2 text-xs text-rose-500">{errors.category_id.message}</p>
          )}
        </div>

        {/* Основная информация */}
        <div className="card p-4 space-y-4">
          <p className="font-semibold text-gray-900">Описание</p>

          <div>
            <label className="label">Заголовок *</label>
            <input
              {...register('title')}
              placeholder="Кратко и понятно..."
              className={`input ${errors.title ? 'input-error' : ''}`}
            />
            {errors.title && <p className="mt-1 text-xs text-rose-500">{errors.title.message}</p>}
          </div>

          <div>
            <label className="label">Описание</label>
            <textarea
              {...register('description')}
              rows={4}
              placeholder="Подробнее об объявлении, состоянии, особенностях..."
              className="input resize-none"
            />
          </div>
        </div>

        {/* Цена */}
        <div className="card p-4 space-y-3">
          <p className="font-semibold text-gray-900">Цена</p>

          <div className="grid grid-cols-2 gap-2">
            {PRICE_TYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setValue('price_type', opt.value as any)}
                className={`py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                  priceType === opt.value
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-100 text-gray-600 hover:border-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {priceType !== 'free' && priceType !== 'negotiable' && (
            <div>
              <label className="label">Сумма (₽)</label>
              <input
                {...register('price', { valueAsNumber: true })}
                type="number"
                min={0}
                placeholder="0"
                className="input"
              />
            </div>
          )}
        </div>

        {/* Фото */}
        <div className="card p-4">
          <p className="font-semibold text-gray-900 mb-3">Фотографии</p>
          <div className="flex flex-wrap gap-2">
            {previews.map((src, i) => (
              <div key={i} className="relative w-20 h-20">
                <img src={src} alt="" className="w-20 h-20 rounded-xl object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
                {i === 0 && (
                  <span className="absolute bottom-0 left-0 right-0 text-center text-white text-xs bg-black/40 rounded-b-xl py-0.5">
                    Главное
                  </span>
                )}
              </div>
            ))}
            {images.length < 8 && (
              <label className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-indigo-400 transition-colors">
                <Camera className="w-5 h-5 text-gray-400" />
                <span className="text-xs text-gray-400">Фото</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
              </label>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">До 8 фото · Первое — главное</p>
        </div>

        {/* Местоположение */}
        <div className="card p-4 space-y-4">
          <p className="font-semibold text-gray-900">Местоположение</p>
          <div>
            <label className="label">Город *</label>
            <input
              {...register('city')}
              placeholder="Москва"
              className={`input ${errors.city ? 'input-error' : ''}`}
            />
            {errors.city && <p className="mt-1 text-xs text-rose-500">{errors.city.message}</p>}
          </div>
          <div>
            <label className="label">Адрес (необязательно)</label>
            <input {...register('address')} placeholder="Улица, дом" className="input" />
          </div>
        </div>

        {/* Контакты */}
        <div className="card p-4 space-y-4">
          <p className="font-semibold text-gray-900">Контакты</p>
          <div>
            <label className="label">Имя *</label>
            <input
              {...register('contact_name')}
              placeholder="Как к вам обращаться"
              className={`input ${errors.contact_name ? 'input-error' : ''}`}
            />
            {errors.contact_name && <p className="mt-1 text-xs text-rose-500">{errors.contact_name.message}</p>}
          </div>
          <div>
            <label className="label">Телефон *</label>
            <input
              {...register('contact_phone')}
              type="tel"
              placeholder="+7 (900) 000-00-00"
              className={`input ${errors.contact_phone ? 'input-error' : ''}`}
            />
            {errors.contact_phone && <p className="mt-1 text-xs text-rose-500">{errors.contact_phone.message}</p>}
          </div>
        </div>

        <button type="submit" disabled={submitting} className="btn-primary btn-lg w-full">
          {submitting ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Публикуем...
            </span>
          ) : '📢 Опубликовать объявление'}
        </button>

        <p className="text-center text-xs text-gray-400 pb-4">
          Объявление будет активно 30 дней
        </p>
      </form>
    </div>
  )
}
