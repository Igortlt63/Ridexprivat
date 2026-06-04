'use client'

import { useEffect, useRef, useState } from 'react'
import { shortenAddress } from '@/lib/address'

declare global {
  interface Window { ymaps: any; _ymapsLoaded?: boolean }
}

export interface RouteAlternative {
  index:    number
  duration: string   // '12 мин'
  distance: string   // '4.2 км'
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
  height?:       string
  className?:    string
}

let scriptPromise: Promise<void> | null = null

function loadYmaps(apiKey: string): Promise<void> {
  if (scriptPromise) return scriptPromise
  if (typeof window !== 'undefined' && window._ymapsLoaded) return Promise.resolve()

  scriptPromise = new Promise((resolve, reject) => {
    if (!apiKey || apiKey === 'undefined') { reject(new Error('No API key')); return }
    const script  = document.createElement('script')
    script.src    = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU`
    script.async  = true
    script.onload = () => window.ymaps.ready(() => { window._ymapsLoaded = true; resolve() })
    script.onerror = () => { scriptPromise = null; reject(new Error('Failed to load Yandex Maps')) }
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
  const containerRef   = useRef<HTMLDivElement>(null)
  const mapRef         = useRef<any>(null)
  const markerRef      = useRef<any>(null)
  const driverRef      = useRef<any>(null)
  const multiRouteRef  = useRef<any>(null)

  const [loaded,      setLoaded]      = useState(false)
  const [error,       setError]       = useState('')
  // Альтернативные маршруты (для navigate режима)
  const [alternatives, setAlternatives] = useState<RouteAlternative[]>([])
  const [activeRoute,  setActiveRoute]  = useState(0)

  // Загрузка SDK
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window._ymapsLoaded) { setLoaded(true); return }
    loadYmaps(apiKey).then(() => setLoaded(true)).catch(e => setError(e.message))
  }, [apiKey])

  // Инициализация карты
  useEffect(() => {
    if (!loaded || !containerRef.current) return
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

        let addr = ''
        try {
          const res = await ymaps.geocode(coords, { results: 1 })
          addr = res.geoObjects.get(0)?.getAddressLine() || ''
        } catch {}

        if (!addr) {
          try {
            const url  = `https://geocode-maps.yandex.ru/1.x/?apikey=${apiKey}&geocode=${lng},${lat}&results=1&format=json&lang=ru_RU`
            const resp = await fetch(url)
            const json = await resp.json()
            addr = json?.response?.GeoObjectCollection?.featureMember?.[0]
              ?.GeoObject?.metaDataProperty?.GeocoderMetaData?.text || ''
          } catch {}
        }
        if (!addr) addr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
        addr = shortenAddress(addr)
        pm.properties.set('balloonContent', addr)
        onPick(lat, lng, addr)
      })
    }

    // ── Статичный маршрут А→Б ────────────────────────────────────
    if (mode === 'route' && originLat && destLat) {
      buildRoute(ymaps, map, originLat, originLng!, destLat, destLng!)
    }

    // ── Слежение за водителем (пассажир) ─────────────────────────
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

    // ── Навигатор для водителя с альтернативными маршрутами ───────
    if (mode === 'navigate' && driverLat && originLat && destLat) {
      // Маркер позиции водителя
      const dm = new ymaps.Placemark(
        [driverLat, driverLng!],
        { balloonContent: 'Вы' },
        { preset: 'islands#blueCarIcon' }
      )
      map.geoObjects.add(dm)
      driverRef.current = dm

      // MultiRoute — 3 варианта маршрута
      const multiRoute = new ymaps.multiRouter.MultiRoute(
        {
          referencePoints: [[originLat, originLng!], [destLat, destLng!]],
          params: { results: 3, routingMode: 'auto' },
        },
        {
          boundsAutoApply:           true,
          routeActiveStrokeColor:    '#4F46E5',
          routeActiveStrokeWidth:    6,
          routeStrokeColor:          '#94A3B8',
          routeStrokeWidth:          4,
          routeActiveStrokeStyle:    'solid',
          wayPointVisible:           false,
          pinVisible:                false,
        }
      )
      map.geoObjects.add(multiRoute)
      multiRouteRef.current = multiRoute

      // Когда маршруты загружены — собираем информацию для панели
      multiRoute.model.events.add('requestsuccess', () => {
        const routes = multiRoute.getRoutes()
        const alts: RouteAlternative[] = []
        routes.each((route: any, i: number) => {
          const props = route.properties.getAll()
          alts.push({
            index:    i,
            duration: props.duration?.text  || '—',
            distance: props.distance?.text  || '—',
          })
        })
        setAlternatives(alts)
        setActiveRoute(0)
      })
    }

    return () => {
      try { map.destroy() } catch {}
      mapRef.current       = null
      markerRef.current    = null
      driverRef.current    = null
      multiRouteRef.current = null
      setAlternatives([])
    }
  }, [loaded, mode, originLat, destLat]) // eslint-disable-line react-hooks/exhaustive-deps

  // Обновление позиции водителя без пересоздания карты
  useEffect(() => {
    if (!driverRef.current || !driverLat) return
    try {
      driverRef.current.geometry.setCoordinates([driverLat, driverLng!])
      if (mapRef.current) {
        mapRef.current.setCenter([driverLat, driverLng!], mapRef.current.getZoom(), {
          duration: 300,
          checkZoomRange: true,
        })
      }
    } catch {}
  }, [driverLat, driverLng])

  // Переключение активного маршрута
  function switchRoute(index: number) {
    if (!multiRouteRef.current) return
    try {
      const routes = multiRouteRef.current.getRoutes()
      multiRouteRef.current.setActiveRoute(routes.get(index))
      setActiveRoute(index)
    } catch {}
  }

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

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ height }}>
      {!loaded && (
        <div className="absolute inset-0 bg-gray-800 flex flex-col items-center justify-center z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent mb-3" />
          <p className="text-xs text-gray-400">Загружаем карту...</p>
        </div>
      )}

      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: '1px' }} />

      {/* Панель альтернативных маршрутов (только navigate + 2+ вариантов) */}
      {mode === 'navigate' && alternatives.length > 1 && (
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
          {alternatives.map(alt => (
            <button
              key={alt.index}
              onClick={() => switchRoute(alt.index)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold shadow-lg transition-all ${
                activeRoute === alt.index
                  ? 'bg-indigo-600 text-white shadow-indigo-300'
                  : 'bg-white/90 backdrop-blur text-gray-700 hover:bg-white'
              }`}
            >
              <span>{alt.index === 0 ? '🏎' : alt.index === 1 ? '🛣' : '🔄'}</span>
              <span>{alt.duration}</span>
              <span className={activeRoute === alt.index ? 'text-indigo-200' : 'text-gray-400'}>
                {alt.distance}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Строим статичный маршрут и красим его
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
    map.geoObjects.add(new ymaps.Placemark([oLat, oLng], {}, { preset: 'islands#greenDotIcon' }))
    map.geoObjects.add(new ymaps.Placemark([dLat, dLng], {}, { preset: 'islands#redDotIcon' }))
    map.setBounds([
      [Math.min(oLat, dLat) - 0.05, Math.min(oLng, dLng) - 0.05],
      [Math.max(oLat, dLat) + 0.05, Math.max(oLng, dLng) + 0.05],
    ])
    return null
  }
}
