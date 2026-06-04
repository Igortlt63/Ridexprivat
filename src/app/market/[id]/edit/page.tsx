'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { z } from 'zod'
import { ChevronLeft, Camera, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ListingStatus, PriceType } from '@/types'

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

const PRICE_TYPE_OPTIONS = [
  { value: 'fixed',      label: 'Фиксированная' },
  { value: 'negotiable', label: 'Договорная' },
  { value: 'free',       label: 'Бесплатно' },
  { value: 'per_hour',   label: 'За час' },
  { value: 'per_day',    label: 'За день' },
]

const editSchema = z.object({
  categoryId:   z.number(),
  title:        z.string().min(5, 'Минимум 5 символов').max(200),
  city:         z.string().min(2, 'Укажите город'),
  contactPhone: z.string().min(10, 'Введите корректный телефон'),
  contactName:  z.string().min(2, 'Введите имя'),
  price:        z.string().optional(),
  priceType:    z.string(),
}).superRefine((data, ctx) => {
  if (data.priceType !== 'free' && data.priceType !== 'negotiable') {
    if (!data.price || isNaN(Number(data.price)) || Number(data.price) < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['price'], message: 'Укажите корректную цену' })
    }
  }
})

export default function EditListingPage() {
  const router      = useRouter()
  const params      = useParams()
  const listingId   = params.id as string
  const supabase    = createClient()

  const [loading,      setLoading]      = useState(true)
  const [submitting,   setSubmitting]   = useState(false)
  const [categories,   setCategories]   = useState(DEFAULT_CATEGORIES)
  const [errors,       setErrors]       = useState<Record<string, string>>({})

  // Поля формы
  const [categoryId,   setCategoryId]   = useState<number | null>(null)
  const [title,        setTitle]        = useState('')
  const [description,  setDescription]  = useState('')
  const [price,        setPrice]        = useState('')
  const [priceType,    setPriceType]    = useState<string>('fixed')
  const [city,         setCity]         = useState('')
  const [address,      setAddress]      = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactName,  setContactName]  = useState('')
  const [status,       setStatus]       = useState<ListingStatus>('active')

  // Фото
  const [existingImages, setExistingImages] = useState<string[]>([])
  const [newFiles,       setNewFiles]       = useState<File[]>([])
  const [newPreviews,    setNewPreviews]     = useState<string[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      const { data: listing, error } = await supabase
        .from('market_listings')
        .select('*')
        .eq('id', listingId)
        .single()

      if (error || !listing) { toast.error('Объявление не найдено'); router.back(); return }
      if (listing.author_id !== user.id) { toast.error('Нет доступа'); router.back(); return }

      // Заполняем форму
      setCategoryId(listing.category_id)
      setTitle(listing.title || '')
      setDescription(listing.description || '')
      setPrice(listing.price?.toString() || '')
      setPriceType(listing.price_type || 'fixed')
      setCity(listing.city || '')
      setAddress(listing.address || '')
      setContactPhone(listing.contact_phone || '')
      setContactName(listing.contact_name || '')
      setStatus(listing.status || 'active')
      setExistingImages(listing.images || [])
      setLoading(false)

      // Загружаем категории из БД
      supabase.from('market_categories').select('*').order('sort_order')
        .then(({ data: cats }) => { if (cats && cats.length > 0) setCategories(cats as typeof DEFAULT_CATEGORIES) })
    }
    load()
  }, [listingId]) // eslint-disable-line react-hooks/exhaustive-deps

  function removeExistingImage(url: string) {
    setExistingImages(prev => prev.filter(u => u !== url))
  }

  function handleNewImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    const total = existingImages.length + newFiles.length + files.length
    if (total > 8) { toast.error('Максимум 8 фото'); return }
    setNewFiles(prev => [...prev, ...files])
    setNewPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
  }

  function removeNewImage(idx: number) {
    setNewFiles(prev => prev.filter((_, i) => i !== idx))
    setNewPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  function validate(): boolean {
    const result = editSchema.safeParse({
      categoryId: categoryId ?? 0,
      title: title.trim(), city: city.trim(),
      contactPhone: contactPhone.trim(), contactName: contactName.trim(),
      price, priceType,
    })
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.errors.forEach(e => { if (e.path[0]) fieldErrors[e.path[0] as string] = e.message })
      setErrors(fieldErrors)
      toast.error(result.error.errors[0]?.message || 'Проверьте поля')
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

    // Загружаем новые фото
    const uploadedUrls: string[] = []
    for (const file of newFiles) {
      const ext  = file.name.split('.').pop()
      const path = `listings/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from('market').upload(path, file)
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from('market').getPublicUrl(path)
        uploadedUrls.push(publicUrl)
      }
    }

    const { error } = await supabase.from('market_listings').update({
      category_id:   categoryId,
      title:         title.trim(),
      description:   description.trim() || null,
      price:         priceType === 'free' || priceType === 'negotiable' ? null : (parseFloat(price) || null),
      price_type:    priceType as PriceType,
      city:          city.trim(),
      address:       address.trim() || null,
      contact_phone: contactPhone.trim(),
      contact_name:  contactName.trim(),
      images:        [...existingImages, ...uploadedUrls],
      status,
      updated_at:    new Date().toISOString(),
    }).eq('id', listingId)

    setSubmitting(false)
    if (error) { toast.error('Ошибка: ' + error.message); return }
    toast.success('Объявление обновлено!')
    router.push(`/market/${listingId}`)
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
            <button onClick={() => router.back()} className="btn-ghost p-2 rounded-xl" aria-label="Назад">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">Редактировать</h1>
          </div>
          <button onClick={onSubmit} disabled={submitting} className="btn-primary btn-sm">
            {submitting ? '...' : 'Сохранить'}
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4 pb-10">

        {/* Категория */}
        <div className="card p-4">
          <p className="font-semibold text-gray-900 mb-3">Категория <span className="text-rose-500">*</span></p>
          <div className="grid grid-cols-3 gap-2">
            {categories.map(cat => (
              <button key={cat.id} type="button"
                onClick={() => setCategoryId(cat.id)}
                className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all text-center ${
                  categoryId === cat.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-100 hover:border-indigo-200'
                }`}
              >
                <span className="text-xl">{(cat as { icon?: string }).icon || '📦'}</span>
                <span className="text-xs font-medium text-gray-700 leading-tight">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Описание */}
        <div className="card p-4 space-y-4">
          <p className="font-semibold text-gray-900">Описание</p>
          <div>
            <label htmlFor="edit-title" className="label">Заголовок <span className="text-rose-500">*</span></label>
            <input id="edit-title" type="text" value={title} onChange={e => setTitle(e.target.value)}
              className={`input ${errors.title ? 'input-error' : ''}`} />
            {errors.title && <p className="mt-1 text-xs text-rose-500">{errors.title}</p>}
          </div>
          <div>
            <label htmlFor="edit-desc" className="label">Описание</label>
            <textarea id="edit-desc" value={description} onChange={e => setDescription(e.target.value)}
              rows={4} className="input resize-none" />
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
                    : 'border-gray-100 text-gray-600'
                }`}
              >{opt.label}</button>
            ))}
          </div>
          {priceType !== 'free' && priceType !== 'negotiable' && (
            <div>
              <label htmlFor="edit-price" className="label">Сумма (₽) <span className="text-rose-500">*</span></label>
              <input id="edit-price" type="number" value={price} onChange={e => setPrice(e.target.value)}
                min={0} className={`input ${errors.price ? 'input-error' : ''}`} />
              {errors.price && <p className="mt-1 text-xs text-rose-500">{errors.price}</p>}
            </div>
          )}
        </div>

        {/* Статус */}
        <div className="card p-4">
          <p className="font-semibold text-gray-900 mb-3">Статус объявления</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { v: 'active',   l: '✅ Активно' },
              { v: 'inactive', l: '🙈 Скрыто' },
              { v: 'sold',     l: '🏁 Продано' },
            ] as const).map(s => (
              <button key={s.v} type="button" onClick={() => setStatus(s.v)}
                className={`py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                  status === s.v ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-100 text-gray-600'
                }`}
              >{s.l}</button>
            ))}
          </div>
        </div>

        {/* Фото */}
        <div className="card p-4">
          <p className="font-semibold text-gray-900 mb-3">Фотографии</p>
          <div className="flex flex-wrap gap-2">
            {/* Существующие фото */}
            {existingImages.map((url, i) => (
              <div key={url} className="relative w-20 h-20">
                <img src={url} alt="" className="w-20 h-20 rounded-xl object-cover" />
                <button type="button" onClick={() => removeExistingImage(url)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center"
                  aria-label="Удалить фото">
                  <X className="w-3 h-3" />
                </button>
                {i === 0 && (
                  <span className="absolute bottom-0 left-0 right-0 text-center text-white text-xs bg-black/40 rounded-b-xl py-0.5">
                    Главное
                  </span>
                )}
              </div>
            ))}
            {/* Новые фото */}
            {newPreviews.map((src, i) => (
              <div key={`new-${i}`} className="relative w-20 h-20">
                <img src={src} alt="" className="w-20 h-20 rounded-xl object-cover" />
                <button type="button" onClick={() => removeNewImage(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center"
                  aria-label="Удалить фото">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {existingImages.length + newFiles.length < 8 && (
              <label className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-indigo-400 transition-colors">
                <Camera className="w-5 h-5 text-gray-400" />
                <span className="text-xs text-gray-400">Фото</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleNewImages} />
              </label>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">До 8 фото · Первое — главное</p>
        </div>

        {/* Местоположение */}
        <div className="card p-4 space-y-3">
          <p className="font-semibold text-gray-900">Местоположение</p>
          <div>
            <label htmlFor="edit-city" className="label">Город <span className="text-rose-500">*</span></label>
            <input id="edit-city" type="text" value={city} onChange={e => setCity(e.target.value)}
              className={`input ${errors.city ? 'input-error' : ''}`} />
            {errors.city && <p className="mt-1 text-xs text-rose-500">{errors.city}</p>}
          </div>
          <div>
            <label htmlFor="edit-address" className="label">Адрес</label>
            <input id="edit-address" type="text" value={address} onChange={e => setAddress(e.target.value)} className="input" />
          </div>
        </div>

        {/* Контакты */}
        <div className="card p-4 space-y-3">
          <p className="font-semibold text-gray-900">Контакты</p>
          <div>
            <label htmlFor="edit-name" className="label">Имя <span className="text-rose-500">*</span></label>
            <input id="edit-name" type="text" value={contactName} onChange={e => setContactName(e.target.value)}
              className={`input ${errors.contactName ? 'input-error' : ''}`} />
            {errors.contactName && <p className="mt-1 text-xs text-rose-500">{errors.contactName}</p>}
          </div>
          <div>
            <label htmlFor="edit-phone" className="label">Телефон <span className="text-rose-500">*</span></label>
            <input id="edit-phone" type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)}
              className={`input ${errors.contactPhone ? 'input-error' : ''}`} />
            {errors.contactPhone && <p className="mt-1 text-xs text-rose-500">{errors.contactPhone}</p>}
          </div>
        </div>

        <button type="button" onClick={onSubmit} disabled={submitting} className="btn-primary btn-lg w-full">
          {submitting ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Сохраняем...
            </span>
          ) : '💾 Сохранить изменения'}
        </button>
      </div>
    </div>
  )
}
