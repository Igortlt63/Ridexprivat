'use client'

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window { ymaps: any; _ymapsLoaded?: boolean }
}

interface Props {
  mode:          'pick' | 'route' | 'track' | 'navigate'
  apiKey:        string
  onPick?:       (lat: number, lng: number, address: string) => void
  pickLabel?:    string
  originLat?:    number; originLng?:  number
  destLat?:      number; destLng?:    number
  driverLat?:    number; driverLng?:  number
  passengerLat?: number; passengerLng?: number
  // navigate — маршрут с живым обновлением позиции водителя
  height?:       string
  className?:    string
}

let scriptPromise: Promise<void> | null = null

function loadYmaps(apiKey: string): Promise<void> {
  if (scriptPromise) return scriptPromise
  if (typeof window !== 'undefined' && window._ymapsLoaded) return Promise.resolve()

  scriptPromise = new Promise((resolve, reject) => {
    if (!apiKey || apiKey === 'undefined') {
      reject(new Error('No API key'))
      return
    }
    const script  = document.createElement('script')
    script.src    = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU`
    script.async  = true
    script.onload = () => window.ymaps.ready(() => {
      window._ymapsLoaded = true
      resolve()
    })
    script.onerror = () => {
      scriptPromise = null // сброс чтобы можно было попробовать снова
      reject(new Error('Failed to load Yandex Maps'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

export default function YandexMap({
  mode, apiKey, onPick, pickLabel,
  originLat, originLng, destLat, destLng,
  driverLat, driverLng, passengerLat, passengerLng,
  height = '300px',
  className = '',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<any>(null)
  const markerRef    = useRef<any>(null)
  const driverRef    = useRef<any>(null)
  const routeRef     = useRef<any>(null)
  const [loaded, setLoaded] = useState(false)
  const [error,  setError]  = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window._ymapsLoaded) { setLoaded(true); return }
    loadYmaps(apiKey)
      .then(() => setLoaded(true))
      .catch(e => setError(e.message))
  }, [apiKey])

  // Инициализация карты
  useEffect(() => {
    if (!loaded || !containerRef.current) return
    // Если контейнер не имеет реальной высоты — не инициализируем
    if (containerRef.current.offsetHeight === 0) return

    const ymaps = window.ymaps

    const center =
      mode === 'route'    && originLat ? [originLat, originLng] :
      mode === 'track'    && driverLat ? [driverLat, driverLng] :
      mode === 'navigate' && driverLat ? [driverLat, driverLng] :
      [55.7558, 37.6176]

    const zoom = mode === 'pick' ? 13 : mode === 'navigate' ? 15 : 11

    const map = new ymaps.Map(containerRef.current, {
      center,
      zoom,
      controls: mode === 'navigate'
        ? ['zoomControl']
        : ['zoomControl', 'geolocationControl'],
    })
    mapRef.current = map

    // ── Выбор точки ──────────────────────────────────────────────
    if (mode === 'pick' && onPick) {
      navigator.geolocation?.getCurrentPosition(
        pos => map.setCenter([pos.coords.latitude, pos.coords.longitude], 15),
        () => {}
      )
      map.events.add('click', async (e: any) => {
        const coords     = e.get('coords')
        const [lat, lng] = coords
        if (markerRef.current) map.geoObjects.remove(markerRef.current)
        const pm = new ymaps.Placemark(coords,
          { balloonContent: pickLabel || 'Выбрано' },
          { preset: 'islands#redCircleDotIcon' }
        )
        map.geoObjects.add(pm)
        markerRef.current = pm

        // Сначала пробуем через ymaps, если не вышло — через HTTP API
        let addr = ''
        try {
          const res = await ymaps.geocode(coords, { results: 1 })
          addr = res.geoObjects.get(0)?.getAddressLine() || ''
        } catch {}

        if (!addr) {
          // Fallback: HTTP Geocoder API
          try {
            const url  = `https://geocode-maps.yandex.ru/1.x/?apikey=${apiKey}&geocode=${lng},${lat}&results=1&format=json&lang=ru_RU`
            const resp = await fetch(url)
            const json = await resp.json()
            addr = json?.response?.GeoObjectCollection?.featureMember?.[0]
              ?.GeoObject?.metaDataProperty?.GeocoderMetaData?.text || ''
          } catch {}
        }

        // Если оба способа не дали адрес — показываем координаты
        if (!addr) addr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`

        pm.properties.set('balloonContent', addr)
        onPick(lat, lng, addr)
      })
    }

    // ── Маршрут А→Б (статичный) ───────────────────────────────────
    if (mode === 'route' && originLat && destLat) {
      buildRoute(ymaps, map, originLat, originLng!, destLat, destLng!)
    }

    // ── Слежение за водителем (для пассажира) ────────────────────
    if (mode === 'track' && driverLat) {
      const dm = new ymaps.Placemark(
        [driverLat, driverLng!],
        { balloonContent: 'Водитель' },
        { preset: 'islands#blueCarIcon' }
      )
      map.geoObjects.add(dm)
      driverRef.current = dm

      if (passengerLat) {
        map.geoObjects.add(new ymaps.Placemark(
          [passengerLat, passengerLng!],
          { balloonContent: 'Вы' },
          { preset: 'islands#greenPersonIcon' }
        ))
      }
      if (originLat && destLat) {
        buildRoute(ymaps, map, originLat, originLng!, destLat, destLng!)
      }
    }

    // ── Навигатор для водителя ────────────────────────────────────
    // Строим маршрут + маркер машины + автоцентрирование
    if (mode === 'navigate' && driverLat && originLat && destLat) {
      const dm = new ymaps.Placemark(
        [driverLat, driverLng!],
        { balloonContent: 'Вы' },
        { preset: 'islands#blueCarIcon' }
      )
      map.geoObjects.add(dm)
      driverRef.current = dm

      buildRoute(ymaps, map, originLat, originLng!, destLat, destLng!).then(r => {
        routeRef.current = r
      })
    }

    return () => {
      try { map.destroy() } catch {}
      mapRef.current    = null
      markerRef.current = null
      driverRef.current = null
      routeRef.current  = null
    }
  }, [loaded, mode, originLat, destLat])
  // Намеренно не включаем driverLat в deps — обновляем через отдельный effect

  // Обновление позиции водителя без пересоздания карты
  useEffect(() => {
    if (!driverRef.current || !driverLat) return
    try {
      driverRef.current.geometry.setCoordinates([driverLat, driverLng!])
      // В режиме навигатора автоцентрируем с поворотом карты
      if (mapRef.current) {
        mapRef.current.setCenter([driverLat, driverLng!], mapRef.current.getZoom(), {
          duration: 300,
          checkZoomRange: true,
        })
      }
    } catch {}
  }, [driverLat, driverLng])

  if (error) return (
    <div
      className={`bg-gray-800 flex flex-col items-center justify-center gap-2 ${className}`}
      style={{ height }}
    >
      <span className="text-3xl">🗺️</span>
      <p className="text-sm text-gray-300">Карта недоступна</p>
      <p className="text-xs text-gray-500">Проверьте NEXT_PUBLIC_YANDEX_MAPS_KEY</p>
    </div>
  )

  // Критично: используем style height вместо h-full чтобы div реально имел высоту
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ height }}
    >
      {!loaded && (
        <div className="absolute inset-0 bg-gray-800 flex flex-col items-center justify-center z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent mb-3" />
          <p className="text-xs text-gray-400">Загружаем карту...</p>
        </div>
      )}
      {/* Контейнер карты должен иметь явные размеры */}
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', minHeight: '1px' }}
      />
    </div>
  )
}

// Строим маршрут и красим его
async function buildRoute(
  ymaps: any, map: any,
  oLat: number, oLng: number,
  dLat: number, dLng: number
) {
  try {
    const route = await ymaps.route(
      [[oLat, oLng], [dLat, dLng]],
      { mapStateAutoApply: true, routingMode: 'auto' }
    )
    map.geoObjects.add(route)
    route.getPaths().each((p: any) => {
      p.options.set({ strokeColor: '#4F46E5', strokeWidth: 6, opacity: 0.9 })
    })
    map.geoObjects.add(new ymaps.Placemark(
      [oLat, oLng],
      { balloonContent: 'Откуда' },
      { preset: 'islands#greenCircleDotIconWithCaption', iconCaption: 'A' }
    ))
    map.geoObjects.add(new ymaps.Placemark(
      [dLat, dLng],
      { balloonContent: 'Куда' },
      { preset: 'islands#redCircleDotIconWithCaption', iconCaption: 'Б' }
    ))
    return route
  } catch {
    // Если построение маршрута не удалось — просто точки
    map.geoObjects.add(new ymaps.Placemark([oLat, oLng], {}, { preset: 'islands#greenDotIcon' }))
    map.geoObjects.add(new ymaps.Placemark([dLat, dLng], {}, { preset: 'islands#redDotIcon' }))
    map.setBounds([
      [Math.min(oLat, dLat) - 0.05, Math.min(oLng, dLng) - 0.05],
      [Math.max(oLat, dLat) + 0.05, Math.max(oLng, dLng) + 0.05],
    ])
    return null
  }
}