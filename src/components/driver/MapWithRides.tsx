'use client'

import { useEffect, useRef } from 'react'
import type { Ride } from '@/types'

interface Props {
  rides:       Ride[]
  myPos:       { lat: number; lng: number }
  apiKey:      string
  onRideClick: (r: Ride) => void
}

export default function MapWithRides({ rides, myPos, apiKey, onRideClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!window.ymaps || !containerRef.current) return
    const ymaps = window.ymaps

    const map = new ymaps.Map(containerRef.current, {
      center: [myPos.lat, myPos.lng],
      zoom: 12,
      controls: ['zoomControl', 'geolocationControl'],
    })

    // Маркер водителя
    map.geoObjects.add(new ymaps.Placemark(
      [myPos.lat, myPos.lng],
      { balloonContent: 'Вы' },
      { preset: 'islands#blueCarIcon' }
    ))

    // Маркеры заказов
    rides.forEach(ride => {
      const mark = new ymaps.Placemark(
        [ride.origin_lat, ride.origin_lng],
        {
          balloonContent: `<b>${ride.origin_address}</b><br/>→ ${ride.dest_address}<br/>`
            + `<b style="color:#4F46E5">${ride.passenger_price.toLocaleString('ru-RU')} ₽</b>`,
          hintContent: `${ride.passenger_price.toLocaleString('ru-RU')} ₽`,
        },
        {
          preset: 'islands#redCircleDotIconWithCaption',
          iconCaption: `${ride.passenger_price.toLocaleString('ru-RU')}₽`,
        }
      )
      mark.events.add('click', () => onRideClick(ride))
      map.geoObjects.add(mark)
    })

    return () => { try { map.destroy() } catch {} }
  }, [rides, myPos, apiKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
