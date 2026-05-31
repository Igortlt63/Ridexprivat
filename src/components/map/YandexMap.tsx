'use client'

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window { ymaps: any; _ymapsLoading?: boolean; _ymapsLoaded?: boolean }
}

interface Props {
  mode:          'pick' | 'route' | 'track'
  apiKey:        string
  onPick?:       (lat: number, lng: number, address: string) => void
  pickLabel?:    string
  originLat?:    number; originLng?:  number
  destLat?:      number; destLng?:    number
  driverLat?:    number; driverLng?:  number
  passengerLat?: number; passengerLng?: number
  height?:       string
}

let scriptPromise: Promise<void> | null = null

function loadYmaps(apiKey: string): Promise<void> {
  if (scriptPromise) return scriptPromise
  if (window._ymapsLoaded) return Promise.resolve()

  scriptPromise = new Promise((resolve, reject) => {
    if (!apiKey || apiKey === 'undefined') {
      reject(new Error('No API key'))
      return
    }
    const script    = document.createElement('script')
    script.src      = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU`
    script.async    = true
    script.onload   = () => {
      window.ymaps.ready(() => {
        window._ymapsLoaded = true
        resolve()
      })
    }
    script.onerror = () => reject(new Error('Failed to load Yandex Maps'))
    document.head.appendChild(script)
  })

  return scriptPromise
}

export default function YandexMap({
  mode, apiKey, onPick, pickLabel,
  originLat, originLng, destLat, destLng,
  driverLat, driverLng, passengerLat, passengerLng,
  height = '300px',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<any>(null)
  const markerRef    = useRef<any>(null)
  const driverRef    = useRef<any>(null)
  const [loaded,  setLoaded]  = useState(false)
  const [error,   setError]   = useState('')

  // Загружаем скрипт один раз глобально
  useEffect(() => {
    if (window._ymapsLoaded) { setLoaded(true); return }
    loadYmaps(apiKey)
      .then(() => setLoaded(true))
      .catch(e => setError(e.message))
  }, [apiKey])

  // Инициализируем карту
  useEffect(() => {
    if (!loaded || !containerRef.current) return

    const ymaps  = window.ymaps
    const center =
      mode === 'route' && originLat ? [originLat, originLng] :
      mode === 'track' && driverLat ? [driverLat, driverLng] :
      [55.7558, 37.6176]

    const map = new ymaps.Map(containerRef.current, {
      center,
      zoom: mode === 'pick' ? 13 : 11,
      controls: ['zoomControl', 'geolocationControl'],
    })
    mapRef.current = map

    // ── Режим выбора точки ──────────────────────────────────────
    if (mode === 'pick' && onPick) {
      navigator.geolocation?.getCurrentPosition(
        pos => map.setCenter([pos.coords.latitude, pos.coords.longitude], 14),
        () => {}
      )

      map.events.add('click', async (e: any) => {
        const coords    = e.get('coords')
        const [lat, lng] = coords

        if (markerRef.current) map.geoObjects.remove(markerRef.current)

        const placemark = new ymaps.Placemark(coords,
          { balloonContent: pickLabel || 'Выбрано' },
          { preset: 'islands#redCircleDotIcon' }
        )
        map.geoObjects.add(placemark)
        markerRef.current = placemark

        try {
          const res     = await ymaps.geocode(coords, { results: 1 })
          const obj     = res.geoObjects.get(0)
          const address = obj?.getAddressLine() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
          placemark.properties.set('balloonContent', address)
          onPick(lat, lng, address)
        } catch {
          onPick(lat, lng, `${lat.toFixed(5)}, ${lng.toFixed(5)}`)
        }
      })
    }

    // ── Маршрут ─────────────────────────────────────────────────
    if (mode === 'route' && originLat && destLat) {
      ymaps.route(
        [[originLat, originLng], [destLat, destLng]],
        { mapStateAutoApply: true, routingMode: 'auto' }
      ).then((route: any) => {
        map.geoObjects.add(route)
        route.getPaths().each((p: any) => {
          p.options.set({ strokeColor: '#4F46E5', strokeWidth: 5, opacity: 0.85 })
        })
        map.geoObjects.add(new ymaps.Placemark(
          [originLat, originLng!],
          { balloonContent: 'Откуда' },
          { preset: 'islands#greenCircleDotIconWithCaption', iconCaption: 'A' }
        ))
        map.geoObjects.add(new ymaps.Placemark(
          [destLat, destLng!],
          { balloonContent: 'Куда' },
          { preset: 'islands#redCircleDotIconWithCaption', iconCaption: 'Б' }
        ))
      }).catch(() => {
        map.geoObjects.add(new ymaps.Placemark([originLat, originLng!], {}, { preset: 'islands#greenDotIcon' }))
        map.geoObjects.add(new ymaps.Placemark([destLat, destLng!], {}, { preset: 'islands#redDotIcon' }))
        map.setBounds([
          [Math.min(originLat, destLat) - 0.05, Math.min(originLng!, destLng!) - 0.05],
          [Math.max(originLat, destLat) + 0.05, Math.max(originLng!, destLng!) + 0.05],
        ])
      })
    }

    // ── Слежение ────────────────────────────────────────────────
    if (mode === 'track' && driverLat) {
      const driverMark = new ymaps.Placemark(
        [driverLat, driverLng!],
        { balloonContent: 'Водитель' },
        { preset: 'islands#blueCarIcon' }
      )
      map.geoObjects.add(driverMark)
      driverRef.current = driverMark

      if (passengerLat) {
        map.geoObjects.add(new ymaps.Placemark(
          [passengerLat, passengerLng!],
          { balloonContent: 'Пассажир' },
          { preset: 'islands#greenPersonIcon' }
        ))
      }
    }

    return () => {
      try { map.destroy() } catch {}
      mapRef.current  = null
      markerRef.current = null
      driverRef.current = null
    }
  }, [loaded, mode, originLat, destLat, driverLat])

  // Обновляем позицию водителя
  useEffect(() => {
    if (mode !== 'track' || !driverRef.current || !driverLat) return
    try {
      driverRef.current.geometry.setCoordinates([driverLat, driverLng!])
      mapRef.current?.setCenter([driverLat, driverLng!])
    } catch {}
  }, [driverLat, driverLng])

  if (error) return (
    <div style={{ height }} className="bg-gray-100 rounded-2xl flex flex-col items-center justify-center text-gray-400 gap-2">
      <span className="text-3xl">🗺️</span>
      <p className="text-sm font-medium">Карта недоступна</p>
      <p className="text-xs text-gray-300">Проверьте ключ Яндекс Карт в .env.local</p>
    </div>
  )

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ height }}>
      {!loaded && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10 rounded-2xl">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent mx-auto mb-2" />
            <p className="text-xs text-gray-400">Загружаем карту...</p>
          </div>
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
