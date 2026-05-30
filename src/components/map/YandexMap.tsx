'use client'

// Компонент Яндекс Карты — используется везде где нужна карта
// Режимы: 'pick' (выбор точки), 'route' (маршрут А→Б), 'track' (слежение за водителем)

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window { ymaps: any }
}

interface Props {
  mode:       'pick' | 'route' | 'track'
  apiKey:     string
  // Для pick
  onPick?:    (lat: number, lng: number, address: string) => void
  pickLabel?: string
  // Для route
  originLat?:  number; originLng?:  number
  destLat?:    number; destLng?:    number
  // Для track
  driverLat?:  number; driverLng?:  number
  passengerLat?: number; passengerLng?: number
  height?:     string
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
  const [loaded, setLoaded] = useState(false)
  const [error,  setError]  = useState(false)

  // Загружаем скрипт Яндекс Карт
  useEffect(() => {
    if (window.ymaps) { setLoaded(true); return }
    if (!apiKey || apiKey === 'undefined') { setError(true); return }

    const script = document.createElement('script')
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU`
    script.async = true
    script.onload = () => {
      window.ymaps.ready(() => setLoaded(true))
    }
    script.onerror = () => setError(true)
    document.head.appendChild(script)

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [apiKey])

  // Инициализируем карту
  useEffect(() => {
    if (!loaded || !containerRef.current) return

    const ymaps = window.ymaps

    // Определяем центр карты
    const center =
      mode === 'route' && originLat ? [originLat, originLng] :
      mode === 'track' && driverLat ? [driverLat, driverLng] :
      [55.7558, 37.6176] // Москва по умолчанию

    const map = new ymaps.Map(containerRef.current, {
      center,
      zoom: mode === 'pick' ? 13 : 12,
      controls: ['zoomControl', 'geolocationControl'],
    })
    mapRef.current = map

    // ── Режим выбора точки ─────────────────────────────────────
    if (mode === 'pick' && onPick) {
      // Пробуем определить геолокацию пользователя
      navigator.geolocation?.getCurrentPosition(pos => {
        map.setCenter([pos.coords.latitude, pos.coords.longitude], 15)
      })

      map.events.add('click', async (e: any) => {
        const coords = e.get('coords')
        const [lat, lng] = coords

        // Удаляем старый маркер
        if (markerRef.current) map.geoObjects.remove(markerRef.current)

        // Ставим новый маркер
        const placemark = new ymaps.Placemark(coords, {
          balloonContent: pickLabel || 'Выбранная точка',
        }, {
          preset: 'islands#redCircleDotIcon',
        })
        map.geoObjects.add(placemark)
        markerRef.current = placemark

        // Геокодируем — получаем адрес по координатам
        try {
          const res = await ymaps.geocode(coords, { results: 1 })
          const obj = res.geoObjects.get(0)
          const address = obj?.getAddressLine() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
          placemark.properties.set('balloonContent', address)
          onPick(lat, lng, address)
        } catch {
          onPick(lat, lng, `${lat.toFixed(5)}, ${lng.toFixed(5)}`)
        }
      })
    }

    // ── Режим маршрута ─────────────────────────────────────────
    if (mode === 'route' && originLat && destLat) {
      ymaps.route([
        [originLat, originLng],
        [destLat, destLng],
      ], {
        mapStateAutoApply: true,
        routingMode: 'auto',
      }).then((route: any) => {
        map.geoObjects.add(route)

        // Красим маршрут
        const paths = route.getPaths()
        paths.each((path: any) => {
          path.options.set({
            strokeColor: '#4F46E5',
            strokeWidth: 5,
            opacity: 0.85,
          })
        })

        // Маркер А
        map.geoObjects.add(new ymaps.Placemark(
          [originLat, originLng!],
          { balloonContent: 'Откуда' },
          { preset: 'islands#greenCircleDotIconWithCaption', iconCaption: 'A' }
        ))
        // Маркер Б
        map.geoObjects.add(new ymaps.Placemark(
          [destLat, destLng!],
          { balloonContent: 'Куда' },
          { preset: 'islands#redCircleDotIconWithCaption', iconCaption: 'Б' }
        ))
      }).catch(() => {
        // Если маршрут не построился — просто показываем точки
        map.geoObjects.add(new ymaps.Placemark([originLat, originLng!], {}, { preset: 'islands#greenDotIcon' }))
        map.geoObjects.add(new ymaps.Placemark([destLat, destLng!], {}, { preset: 'islands#redDotIcon' }))
        map.setBounds([[
          Math.min(originLat, destLat!) - 0.05,
          Math.min(originLng!, destLng!) - 0.05,
        ],[
          Math.max(originLat, destLat!) + 0.05,
          Math.max(originLng!, destLng!) + 0.05,
        ]])
      })
    }

    // ── Режим слежения ─────────────────────────────────────────
    if (mode === 'track' && driverLat) {
      // Маркер водителя
      const driverMark = new ymaps.Placemark(
        [driverLat, driverLng!],
        { balloonContent: 'Водитель' },
        { preset: 'islands#blueCarIcon' }
      )
      map.geoObjects.add(driverMark)
      driverRef.current = driverMark

      // Маркер пассажира
      if (passengerLat) {
        map.geoObjects.add(new ymaps.Placemark(
          [passengerLat, passengerLng!],
          { balloonContent: 'Вы' },
          { preset: 'islands#greenPersonIcon' }
        ))
      }
    }

    return () => {
      try { map.destroy() } catch {}
      mapRef.current = null
    }
  }, [loaded, mode, originLat, destLat, driverLat])

  // Обновляем позицию водителя в режиме track
  useEffect(() => {
    if (mode !== 'track' || !driverRef.current || !driverLat) return
    driverRef.current.geometry.setCoordinates([driverLat, driverLng!])
    mapRef.current?.setCenter([driverLat, driverLng!])
  }, [driverLat, driverLng])

  if (error) return (
    <div
      style={{ height }}
      className="bg-gray-100 rounded-2xl flex flex-col items-center justify-center text-gray-400 gap-2"
    >
      <span className="text-3xl">🗺️</span>
      <p className="text-sm">Карта недоступна</p>
      <p className="text-xs text-gray-300">Проверьте ключ Яндекс Карт</p>
    </div>
  )

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ height }}>
      {!loaded && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent" />
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
