'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { z } from 'zod'
import { ChevronLeft, Camera, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Категории захардкожены как fallback — не зависим от БД при загрузке
const DEFAULT_CATEGORIES = [
  { id: 1,  slug: 'services',     name: 'Услуги',           icon: '🔧' },
  { id: 2,  slug: 'real_estate',  name: 'Недвижимость',     icon: '🏠' },
  { id: 3,  slug: 'cargo',        name: 'Грузоперевозки',   icon: '🚛' },
  { id: 4,  slug: 'special_tech', name: 'Спецтехника',      icon: '🚜' },
  { id: 5,  slug: 'hotels',       name: 'Гостиницы',        icon: '🏨' },
  { id: 6,  slug: 'cars_sale',    name: 'Авто на продажу',  icon: '🚗' },
  { id: 7,  slug: 'cars_rent',    name: 'Авто в аренду',    icon: '🔑' },
  { id: 8,  slug: 'spare_parts',  name: 'Запчасти',         icon: '⚙️' },
  { id: 9,  slug: 'wheels',       name: 'Колёса / шины',    icon: '🛞' },
  { id: 10, slug: 'car_wash',     name: 'Автомойки',        icon: '💦' },
  { id: 11, slug: 'car_service',  name: 'Автосервисы',      icon: '🔩' },
]

// ── Zod-схема формы объявления ────────────────────────────────
const listingSchema = z.object({
  categoryId:   z.number({ required_error: 'Выберите категорию' }),
  title:        z.string().min(5, 'Минимум 5 символов').max(200, 'Максимум 200 символов'),
  city:         z.string().min(2, 'Укажите город').max(100),
  contactPhone: z.string().min(10, 'Введите корректный телефон').max(20),
  contactName:  z.string().min(2, 'Введите имя').max(100),
  price:        z.string().optional(),
  priceType:    z.string(),
}).superRefine((data, ctx) => {
  if (data.priceType !== 'free' && data.priceType !== 'negotiable') {
    if (!data.price || isNaN(Number(data.price)) || Number(data.price) < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['price'], message: 'Укажите корректную цену' })
    }
  }
})

const PRICE_TYPE_OPTIONS = [
  { value: 'fixed',      label: 'Фиксированная' },
  { value: 'negotiable', label: 'Договорная' },
  { value: 'free',       label: 'Бесплатно' },
  { value: 'per_hour',   label: 'За час' },
  { value: 'per_day',    label: 'За день' },
]

export default function NewListingPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [categories,   setCategories]   = useState(DEFAULT_CATEGORIES)
  const [categoryId,   setCategoryId]   = useState<number | null>(null)
  const [title,        setTitle]        = useState('')
  const [description,  setDescription]  = useState('')
  const [price,        setPrice]        = useState('')
  const [priceType,    setPriceType]    = useState('fixed')
  const [city,         setCity]         = useState('')
  const [address,      setAddress]      = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactName,  setContactName]  = useState('')
  const [images,       setImages]       = useState<File[]>([])
  const [previews,     setPreviews]     = useState<string[]>([])
  const [submitting,   setSubmitting]   = useState(false)
  const [errors,       setErrors]       = useState<Record<string, string>>({})

  useEffect(() => {
    // Загружаем категории из БД — но показываем дефолтные сразу
    supabase.from('market_categories').select('*').order('sort_order')
      .then(({ data }) => { if (data && data.length > 0) setCategories(data as typeof DEFAULT_CATEGORIES) })

    // Автозаполняем контакты
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: prof } = await supabase.from('profiles')
        .select('phone, full_name').eq('id', user.id).single()
      if (prof?.phone)     setContactPhone(prof.phone)
      if (prof?.full_name) setContactName(prof.full_name)
    })
  }, [])

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (images.length + files.length > 8) { toast.error('Максимум 8 фото'); return }
    const newFiles    = [...images, ...files]
    setImages(newFiles)
    setPreviews(newFiles.map(f => URL.createObjectURL(f)))
  }

  function removeImage(idx: number) {
    const newFiles = images.filter((_, i) => i !== idx)
    setImages(newFiles)
    setPreviews(newFiles.map(f => URL.createObjectURL(f)))
  }

  function validate(): boolean {
    if (!categoryId) {
      toast.error('Выберите категорию')
      setErrors({ category: 'Выберите категорию' })
      return false
    }
    const result = listingSchema.safeParse({
      categoryId, title: title.trim(), city: city.trim(),
      contactPhone: contactPhone.trim(), contactName: contactName.trim(),
      price, priceType,
    })
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.errors.forEach(e => {
        const field = e.path[0] as string
        if (field) fieldErrors[field] = e.message
      })
      setErrors(fieldErrors)
      toast.error(result.error.errors[0]?.message || 'Заполните обязательные поля')
      return false
    }
    setErrors({})
    return true
  }

  async function onSubmit() {
    if (!validate()) return

    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    // Загружаем фото
    const uploadedUrls: string[] = []
    for (const file of images) {
      const ext  = file.name.split('.').pop()
      const path = `listings/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from('market').upload(path, file)
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from('market').getPublicUrl(path)
        uploadedUrls.push(publicUrl)
      }
    }

    const { data: listing, error } = await supabase.from('market_listings').insert({
      author_id:     user.id,
      category_id:   categoryId,
      title:         title.trim(),
      description:   description.trim() || null,
      price:         priceType === 'free' || priceType === 'negotiable' ? null : (parseFloat(price) || null),
      price_type:    priceType,
      city:          city.trim(),
      address:       address.trim() || null,
      contact_phone: contactPhone.trim(),
      contact_name:  contactName.trim(),
      images:        uploadedUrls,
      status:        'active',
    }).select().single()

    setSubmitting(false)

    if (error) {
      console.error('Insert error:', error)
      toast.error('Ошибка: ' + error.message)
      return
    }

    toast.success('Объявление опубликовано!')
    router.push(`/market/${listing.id}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="btn-ghost p-2 rounded-xl">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">Новое объявление</h1>
          </div>
          <button onClick={onSubmit} disabled={submitting} className="btn-primary btn-sm">
            {submitting ? '...' : 'Опубликовать'}
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4 pb-10">

        {/* Категория — всегда показываем, не ждём загрузки */}
        <div className="card p-4">
          <p className="font-semibold text-gray-900 mb-3">
            Категория <span className="text-rose-500">*</span>
          </p>
          <div className="grid grid-cols-3 gap-2">
            {categories.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => { setCategoryId(cat.id); setErrors(e => ({ ...e, category: '' })) }}
                className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all text-center ${
                  categoryId === cat.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-100 hover:border-indigo-200 hover:bg-gray-50'
                }`}
              >
                <span className="text-xl">{(cat as { icon?: string }).icon || '📦'}</span>
                <span className="text-xs font-medium text-gray-700 leading-tight">{cat.name}</span>
              </button>
            ))}
          </div>
          {errors.category && <p className="mt-2 text-xs text-rose-500">{errors.category}</p>}
        </div>

        {/* Описание */}
        <div className="card p-4 space-y-4">
          <p className="font-semibold text-gray-900">Описание</p>
          <div>
            <label className="label">Заголовок <span className="text-rose-500">*</span></label>
            <input
              type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Кратко и понятно..."
              className={`input ${errors.title ? 'input-error' : ''}`}
            />
            {errors.title && <p className="mt-1 text-xs text-rose-500">{errors.title}</p>}
          </div>
          <div>
            <label className="label">Описание</label>
            <textarea
              value={description} onChange={e => setDescription(e.target.value)}
              rows={4} placeholder="Подробнее об объявлении..." className="input resize-none"
            />
          </div>
        </div>

        {/* Цена */}
        <div className="card p-4 space-y-3">
          <p className="font-semibold text-gray-900">Цена</p>
          <div className="grid grid-cols-2 gap-2">
            {PRICE_TYPE_OPTIONS.map(opt => (
              <button key={opt.value} type="button" onClick={() => setPriceType(opt.value)}
                className={`py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                  priceType === opt.value
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-100 text-gray-600 hover:border-gray-200'
                }`}
              >{opt.label}</button>
            ))}
          </div>
          {priceType !== 'free' && priceType !== 'negotiable' && (
            <div>
              <label className="label">Сумма (₽) <span className="text-rose-500">*</span></label>
              <input
                type="number" value={price} onChange={e => setPrice(e.target.value)}
                min={0} placeholder="0"
                className={`input ${errors.price ? 'input-error' : ''}`}
              />
              {errors.price && <p className="mt-1 text-xs text-rose-500">{errors.price}</p>}
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
                <button type="button" onClick={() => removeImage(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center">
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
        <div className="card p-4 space-y-3">
          <p className="font-semibold text-gray-900">Местоположение</p>
          <div>
            <label className="label">Город <span className="text-rose-500">*</span></label>
            <input type="text" value={city} onChange={e => setCity(e.target.value)}
              placeholder="Москва"
              className={`input ${errors.city ? 'input-error' : ''}`}
            />
            {errors.city && <p className="mt-1 text-xs text-rose-500">{errors.city}</p>}
          </div>
          <div>
            <label className="label">Адрес (необязательно)</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)}
              placeholder="Улица, дом" className="input" />
          </div>
        </div>

        {/* Контакты */}
        <div className="card p-4 space-y-3">
          <p className="font-semibold text-gray-900">Контакты</p>
          <div>
            <label className="label">Имя <span className="text-rose-500">*</span></label>
            <input type="text" value={contactName} onChange={e => setContactName(e.target.value)}
              placeholder="Как к вам обращаться"
              className={`input ${errors.name ? 'input-error' : ''}`}
            />
            {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name}</p>}
          </div>
          <div>
            <label className="label">Телефон <span className="text-rose-500">*</span></label>
            <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)}
              placeholder="+7 (900) 000-00-00"
              className={`input ${errors.phone ? 'input-error' : ''}`}
            />
            {errors.phone && <p className="mt-1 text-xs text-rose-500">{errors.phone}</p>}
          </div>
        </div>

        <button type="button" onClick={onSubmit} disabled={submitting} className="btn-primary btn-lg w-full">
          {submitting ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Публикуем...
            </span>
          ) : '📢 Опубликовать объявление'}
        </button>
        <p className="text-center text-xs text-gray-400 pb-4">Объявление будет активно 30 дней</p>
      </div>
    </div>
  )
}
