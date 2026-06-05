# RideShare — контекст проекта

## Что это
Мобильное приложение на **Next.js 14 + Supabase** для России:
- Заказ такси с договорной ценой (торг между пассажиром и водителем)
- Биржа водителей с realtime-обновлениями
- Маркетплейс объявлений (11 категорий)

**Стек:** Next.js 14 (App Router) · TypeScript (strict) · Tailwind CSS · Supabase (PostgreSQL + Realtime + Auth) · Zustand · Zod · Yandex Maps API 2.1 · date-fns · react-hot-toast

---

## Структура

```
src/
├── app/
│   ├── auth/                  # Вход / регистрация / сброс пароля
│   ├── passenger/             # Кабинет пассажира
│   │   ├── page.tsx           # Активные поездки
│   │   ├── new-ride/          # Создание заявки (3 шага: откуда → куда → детали)
│   │   ├── ride/[id]/         # Статус поездки + торг + чат + карта
│   │   ├── history/           # История поездок (пагинация 20 шт.)
│   │   ├── routes/            # Сохранённые маршруты
│   │   └── support/           # FAQ + форма обращения
│   ├── driver/                # Кабинет водителя
│   │   ├── page.tsx           # Список заявок / карта (online/offline toggle)
│   │   ├── ride/[id]/         # Активная поездка (навигатор + чат)
│   │   ├── earnings/          # Заработок с графиком по дням
│   │   ├── history/           # История рейсов (пагинация 20 шт.)
│   │   └── vehicle/           # Управление авто
│   ├── market/                # Маркетплейс
│   │   ├── page.tsx           # Список (группировка по категориям / фильтр)
│   │   ├── [id]/page.tsx      # Детальная страница объявления
│   │   ├── [id]/edit/         # Редактирование своего объявления
│   │   ├── new/               # Создание объявления
│   │   ├── my/                # Мои объявления (фильтр по статусу)
│   │   └── chat/[chatId]/     # Чат покупатель ↔ продавец
│   ├── profile/               # Профиль пользователя
│   │   ├── page.tsx           # Редактирование + быстрые ссылки
│   │   ├── reviews/           # Отзывы обо мне / мои отзывы
│   │   └── vehicle/[id]/      # Управление авто водителя
│   └── chats/                 # Все чаты
├── components/
│   ├── driver/
│   │   ├── OfferModal.tsx     # Модалка торга (отдельный компонент)
│   │   ├── RideCard.tsx       # Карточка заявки
│   │   └── MapWithRides.tsx   # Карта с маркерами заявок
│   ├── map/
│   │   └── YandexMap.tsx      # Универсальная карта (4 режима: pick/route/track/navigate)
│   │                          # navigate режим: multiRouter с 3 альтернативными маршрутами
│   ├── shared/
│   │   └── ReviewBlock.tsx    # Блок оценки (используется пассажиром и водителем)
│   └── ui/
│       └── LiveIndicator.tsx  # Индикатор realtime-соединения
├── lib/
│   ├── address.ts             # shortenAddress() — убирает страну/регион из адреса Яндекса
│   ├── cars.ts                # Данные марок/моделей авто
│   └── supabase/
│       ├── client.ts          # Browser Supabase client
│       └── server.ts          # Server Supabase client
├── store/
│   └── useAppStore.ts         # Zustand — кеш профиля (loadProfile / refreshProfile)
└── types/
    └── index.ts               # Все типы: Profile, Ride, RideOffer, RideMessage,
                               # DriverVehicle, MarketListing, MarketCategory и др.
```

---

## База данных (Supabase)

### Таблицы
| Таблица | Назначение |
|---|---|
| `profiles` | Пользователи (phone, rating_driver, rating_passenger, total_rides_*) |
| `rides` | Поездки (status, arrived_at, started_at, completed_at, ...) |
| `ride_offers` | Предложения водителей (торг) |
| `ride_messages` | Чат внутри поездки |
| `driver_vehicles` | Авто водителей (photo_url добавлен) |
| `driver_status` | Онлайн-статус + геолокация (PostGIS) |
| `market_listings` | Объявления маркета |
| `market_categories` | 11 категорий (ID 1–11, засеяны миграцией 005) |
| `market_chats` | Чаты маркета |
| `market_messages` | Сообщения маркета |
| `reviews` | Отзывы (UNIQUE ride_id + reviewer_id) |
| `saved_routes` | Сохранённые маршруты пассажира |
| `notifications` | Уведомления |
| `favorites` | Избранное маркета |

### Поле `arrived_at` в `rides`
Добавлено миграцией `004_arrived_at.sql`. Фиксирует момент прибытия водителя к точке посадки. Запускает таймер ожидания у обеих сторон.

### Триггеры (миграция 003)
- `trigger_update_rating` — пересчитывает `rating_driver` / `rating_passenger` после каждого INSERT в `reviews`
- `trigger_update_ride_counts` — инкрементирует `total_rides_*` при завершении поездки

### Миграции (применять в порядке номеров)
```
001_initial_schema.sql   — схема БД
002_fixes.sql            — чаты маркета, RLS, триггер профиля
003_ratings_trigger.sql  — динамические рейтинги
004_arrived_at.sql       — поле arrived_at в rides
005_market_categories_seed.sql — данные категорий маркета (ОБЯЗАТЕЛЬНО!)
```

---

## Статусы поездки
```
searching → negotiating → accepted → [arrived_at set] → in_progress → completed
                                 ↘ cancelled (в любой момент)
```
- `arrived_at` — не отдельный статус, а поле timestamp. Когда установлено при `accepted` — UI показывает таймер ожидания

---

## Realtime-подписки
Везде используется паттерн с `channelRef`:
```typescript
const channelRef = useRef<RealtimeChannel | null>(null)
// В useEffect: channelRef.current = supabase.channel(...)
// В cleanup: supabase.removeChannel(channelRef.current)
```
**Важно:** cleanup возвращается из `useEffect`, а не из внутренней `async load()` — иначе утечка памяти.

---

## YandexMap — режимы
| mode | Описание |
|---|---|
| `pick` | Кликнуть на карте → получить адрес (с sокращением через `shortenAddress`) |
| `route` | Статичный маршрут A→B |
| `track` | Следить за водителем (для пассажира) |
| `navigate` | Навигатор водителя с 3 альтернативными маршрутами (multiRouter) |

---

## Сокращение адресов
`src/lib/address.ts` → `shortenAddress(full)` убирает «Россия», регионы, оставляет «Город, Улица, Дом».
Используется в `new-ride/page.tsx` и `YandexMap.tsx`.

---

## Переменные окружения
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
NEXT_PUBLIC_YANDEX_MAPS_KEY=xxx
```

---

## Деплой
- Сервер: VPS с Nginx + PM2
- Обновление: `git pull && npm run build && pm2 restart rideshare`
- Nginx проксирует `localhost:3000`

---

## Система ролей и тем

### Роли
- `activeRole: 'passenger' | 'driver'` хранится в Zustand (`useAppStore`) + `localStorage`
- Переключатель — в `profile/page.tsx` (сегментированный слайдер)
- Главный экран (`page.tsx`) полностью меняется в зависимости от роли:
  - **Пассажир**: создать заявку, история, маршруты, чат
  - **Водитель**: принять заказ, заработок, история рейсов, чат
- Роли не пересекаются — каждая показывает только свой функционал

### Темы
- `theme: 'light' | 'dark' | 'system'` хранится в Zustand + `localStorage`
- Переключатель — в `profile/page.tsx`
- Применяется через класс `dark` на `<html>` (Tailwind `darkMode: 'class'`)
- `ThemeProvider` (`src/components/ThemeProvider.tsx`) — следит за системной темой
- Тёмные стили: все `.card`, `.input`, `.btn-*` в `globals.css` имеют `dark:` варианты

## Что НЕ реализовано / TODO
- Push-уведомления (только toast внутри приложения)
- Верификация водителей (поле `is_verified` есть, логика — нет)
- Страница `driver/earnings` показывает данные, но нет экспорта
- `passenger/support` — форма обращения имитирует отправку (setTimeout), реальный backend не подключён
- Адаптация под десктоп (всё ограничено `max-w-lg`)
- Оптимизация изображений через `next/image` (пока обычный `<img>`)
