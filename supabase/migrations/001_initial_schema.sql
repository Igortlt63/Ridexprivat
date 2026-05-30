-- ============================================================
-- RIDESHARE APP — Начальная схема базы данных
-- Supabase / PostgreSQL
-- ============================================================

-- Включаем расширения
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis"; -- для геолокации

-- ============================================================
-- ТАБЛИЦА ПОЛЬЗОВАТЕЛЕЙ
-- ============================================================
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone         TEXT UNIQUE NOT NULL,
  full_name     TEXT,
  avatar_url    TEXT,
  rating_passenger NUMERIC(3,2) DEFAULT 5.00,
  rating_driver    NUMERIC(3,2) DEFAULT 5.00,
  total_rides_as_passenger INTEGER DEFAULT 0,
  total_rides_as_driver    INTEGER DEFAULT 0,
  is_verified   BOOLEAN DEFAULT FALSE,
  is_blocked    BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ТАБЛИЦА АВТОМОБИЛЕЙ ВОДИТЕЛЯ
-- ============================================================
CREATE TABLE public.driver_vehicles (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  brand         TEXT NOT NULL,       -- марка
  model         TEXT NOT NULL,       -- модель
  year          INTEGER NOT NULL,
  color         TEXT NOT NULL,
  plate_number  TEXT NOT NULL,       -- гос. номер
  seats_count   INTEGER DEFAULT 4,   -- количество мест
  is_verified   BOOLEAN DEFAULT FALSE,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- СТАТУС ВОДИТЕЛЯ (онлайн/офлайн + геолокация)
-- ============================================================
CREATE TABLE public.driver_status (
  driver_id     UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_online     BOOLEAN DEFAULT FALSE,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  -- PostGIS точка для быстрого поиска по радиусу
  location      GEOGRAPHY(POINT, 4326),
  last_seen     TIMESTAMPTZ DEFAULT NOW(),
  vehicle_id    UUID REFERENCES public.driver_vehicles(id)
);

-- Индекс для быстрого поиска водителей рядом
CREATE INDEX idx_driver_location ON public.driver_status USING GIST (location);

-- ============================================================
-- ТАБЛИЦА ЗАЯВОК НА ПОЕЗДКУ
-- ============================================================
CREATE TABLE public.rides (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  passenger_id    UUID NOT NULL REFERENCES public.profiles(id),
  driver_id       UUID REFERENCES public.profiles(id),

  -- Откуда
  origin_address  TEXT NOT NULL,
  origin_lat      DOUBLE PRECISION NOT NULL,
  origin_lng      DOUBLE PRECISION NOT NULL,

  -- Куда
  dest_address    TEXT NOT NULL,
  dest_lat        DOUBLE PRECISION NOT NULL,
  dest_lng        DOUBLE PRECISION NOT NULL,

  -- Цена
  passenger_price NUMERIC(10,2) NOT NULL,  -- цена пассажира
  final_price     NUMERIC(10,2),           -- итоговая цена (после торга)

  -- Дополнительно
  comment         TEXT,                    -- пожелания пассажира
  seats_needed    INTEGER DEFAULT 1,
  allow_luggage   BOOLEAN DEFAULT FALSE,
  allow_pets      BOOLEAN DEFAULT FALSE,
  no_smoking      BOOLEAN DEFAULT FALSE,
  ride_type       TEXT DEFAULT 'city' CHECK (ride_type IN ('city','intercity')),

  -- Статус
  status          TEXT DEFAULT 'searching' CHECK (status IN (
    'searching',    -- ищем водителя
    'negotiating',  -- идёт торг
    'accepted',     -- водитель принят
    'in_progress',  -- поездка началась
    'completed',    -- завершена
    'cancelled'     -- отменена
  )),

  -- Время
  scheduled_at    TIMESTAMPTZ,             -- если поездка на потом
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 minutes'),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы
CREATE INDEX idx_rides_status ON public.rides(status);
CREATE INDEX idx_rides_passenger ON public.rides(passenger_id);
CREATE INDEX idx_rides_driver ON public.rides(driver_id);

-- ============================================================
-- ПРЕДЛОЖЕНИЯ ВОДИТЕЛЕЙ (торг)
-- ============================================================
CREATE TABLE public.ride_offers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id         UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  driver_id       UUID NOT NULL REFERENCES public.profiles(id),
  offered_price   NUMERIC(10,2) NOT NULL,  -- цена водителя
  message         TEXT,                    -- сообщение водителя
  status          TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',    -- ждёт ответа пассажира
    'accepted',   -- принято
    'rejected',   -- отклонено
    'expired'     -- устарело
  )),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_offers_ride ON public.ride_offers(ride_id);
CREATE INDEX idx_offers_driver ON public.ride_offers(driver_id);

-- ============================================================
-- ЧАТ ВНУТРИ ПОЕЗДКИ
-- ============================================================
CREATE TABLE public.ride_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id     UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES public.profiles(id),
  message     TEXT NOT NULL,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_ride ON public.ride_messages(ride_id);

-- ============================================================
-- ОТЗЫВЫ
-- ============================================================
CREATE TABLE public.reviews (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id         UUID NOT NULL REFERENCES public.rides(id),
  reviewer_id     UUID NOT NULL REFERENCES public.profiles(id),
  reviewed_id     UUID NOT NULL REFERENCES public.profiles(id),
  role_reviewed   TEXT CHECK (role_reviewed IN ('driver', 'passenger')),
  rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ride_id, reviewer_id)
);

-- ============================================================
-- МАРКЕТ — ОБЪЯВЛЕНИЯ
-- ============================================================
CREATE TABLE public.market_categories (
  id          SERIAL PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  icon        TEXT,
  sort_order  INTEGER DEFAULT 0
);

INSERT INTO public.market_categories (slug, name, icon, sort_order) VALUES
  ('services',      'Услуги',              'wrench',     1),
  ('real_estate',   'Недвижимость',        'home',       2),
  ('cargo',         'Грузоперевозки',      'truck',      3),
  ('special_tech',  'Спецтехника',         'bulldozer',  4),
  ('hotels',        'Гостиницы',           'hotel',      5),
  ('cars_sale',     'Авто на продажу',     'car',        6),
  ('cars_rent',     'Авто в аренду',       'key',        7),
  ('spare_parts',   'Запчасти',            'tool',       8),
  ('wheels',        'Колёса / шины / диски','circle',    9),
  ('car_wash',      'Автомойки',           'droplets',   10),
  ('car_service',   'Автосервисы',         'settings',   11);

CREATE TABLE public.market_listings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id       UUID NOT NULL REFERENCES public.profiles(id),
  category_id     INTEGER NOT NULL REFERENCES public.market_categories(id),

  title           TEXT NOT NULL,
  description     TEXT,
  price           NUMERIC(12,2),
  price_type      TEXT DEFAULT 'fixed' CHECK (price_type IN ('fixed','negotiable','free','per_hour','per_day')),
  currency        TEXT DEFAULT 'RUB',

  -- Геолокация объявления
  city            TEXT,
  address         TEXT,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,

  -- Медиа
  images          TEXT[],             -- массив URL фотографий

  -- Контакты
  contact_phone   TEXT,
  contact_name    TEXT,

  -- Статус
  status          TEXT DEFAULT 'active' CHECK (status IN ('active','inactive','sold','moderation')),
  is_promoted     BOOLEAN DEFAULT FALSE,    -- платное продвижение
  promoted_until  TIMESTAMPTZ,
  views_count     INTEGER DEFAULT 0,

  expires_at      TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_listings_category ON public.market_listings(category_id);
CREATE INDEX idx_listings_author ON public.market_listings(author_id);
CREATE INDEX idx_listings_status ON public.market_listings(status);

-- ============================================================
-- ИЗБРАННОЕ (заявки и объявления)
-- ============================================================
CREATE TABLE public.favorites (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id    UUID REFERENCES public.market_listings(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, listing_id)
);

-- ============================================================
-- ЧАТЫ МАРКЕТА
-- ============================================================
CREATE TABLE public.market_chats (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id      UUID NOT NULL REFERENCES public.market_listings(id) ON DELETE CASCADE,
  buyer_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_message    TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, buyer_id)
);

CREATE TABLE public.market_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id     UUID NOT NULL REFERENCES public.market_chats(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES public.profiles(id),
  message     TEXT NOT NULL,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_market_messages_chat ON public.market_messages(chat_id);
CREATE INDEX idx_market_chats_buyer ON public.market_chats(buyer_id);
CREATE INDEX idx_market_chats_seller ON public.market_chats(seller_id);

-- ============================================================
-- УВЕДОМЛЕНИЯ
-- ============================================================
CREATE TABLE public.notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,  -- 'new_offer', 'offer_accepted', 'ride_started', etc.
  title       TEXT NOT NULL,
  body        TEXT,
  data        JSONB,           -- доп. данные (ride_id, offer_id и т.д.)
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read);

-- ============================================================
-- ИЗБРАННЫЕ МАРШРУТЫ (пассажир)
-- ============================================================
CREATE TABLE public.saved_routes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,         -- "Домой", "На работу"
  origin_address  TEXT NOT NULL,
  origin_lat      DOUBLE PRECISION,
  origin_lng      DOUBLE PRECISION,
  dest_address    TEXT NOT NULL,
  dest_lat        DOUBLE PRECISION,
  dest_lng        DOUBLE PRECISION,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS (Row Level Security) — безопасность на уровне строк
-- ============================================================

-- Профили: каждый видит всех, но редактирует только свой
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (TRUE);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Поездки
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rides viewable by participants" ON public.rides FOR SELECT USING (
  auth.uid() = passenger_id OR auth.uid() = driver_id OR status = 'searching'
);
CREATE POLICY "Passengers can create rides" ON public.rides FOR INSERT WITH CHECK (auth.uid() = passenger_id);
CREATE POLICY "Participants can update rides" ON public.rides FOR UPDATE USING (
  auth.uid() = passenger_id OR auth.uid() = driver_id
);

-- Предложения
ALTER TABLE public.ride_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Offers viewable by ride participants" ON public.ride_offers FOR SELECT USING (
  auth.uid() = driver_id OR
  auth.uid() IN (SELECT passenger_id FROM public.rides WHERE id = ride_id)
);
CREATE POLICY "Drivers can create offers" ON public.ride_offers FOR INSERT WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "Passengers can update offer status" ON public.ride_offers FOR UPDATE USING (
  auth.uid() IN (SELECT passenger_id FROM public.rides WHERE id = ride_id)
);

-- Сообщения
ALTER TABLE public.ride_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Messages viewable by ride participants" ON public.ride_messages FOR SELECT USING (
  auth.uid() = sender_id OR
  auth.uid() IN (
    SELECT passenger_id FROM public.rides WHERE id = ride_id
    UNION
    SELECT driver_id FROM public.rides WHERE id = ride_id
  )
);
CREATE POLICY "Participants can send messages" ON public.ride_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Объявления
ALTER TABLE public.market_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active listings viewable by all" ON public.market_listings FOR SELECT USING (status = 'active' OR auth.uid() = author_id);
CREATE POLICY "Users can create listings" ON public.market_listings FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can update listings" ON public.market_listings FOR UPDATE USING (auth.uid() = author_id);

-- Уведомления
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Users can mark own as read" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Статус водителя
ALTER TABLE public.driver_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Driver status viewable by all" ON public.driver_status FOR SELECT USING (TRUE);
CREATE POLICY "Drivers manage own status" ON public.driver_status FOR ALL USING (auth.uid() = driver_id);

-- Сохранённые маршруты
ALTER TABLE public.saved_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own routes" ON public.saved_routes FOR ALL USING (auth.uid() = user_id);

-- Автомобили водителей
ALTER TABLE public.driver_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vehicles viewable by all" ON public.driver_vehicles FOR SELECT USING (TRUE);
CREATE POLICY "Drivers manage own vehicles" ON public.driver_vehicles FOR ALL USING (auth.uid() = driver_id);

-- Отзывы
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviews viewable by all" ON public.reviews FOR SELECT USING (TRUE);
CREATE POLICY "Users can create reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- Избранное
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own favorites" ON public.favorites FOR ALL USING (auth.uid() = user_id);

-- Чаты маркета
ALTER TABLE public.market_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chat participants can view" ON public.market_chats FOR SELECT USING (
  auth.uid() = buyer_id OR auth.uid() = seller_id
);
CREATE POLICY "Buyers can create chats" ON public.market_chats FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Participants can update chats" ON public.market_chats FOR UPDATE USING (
  auth.uid() = buyer_id OR auth.uid() = seller_id
);

-- Сообщения маркета
ALTER TABLE public.market_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chat participants can view messages" ON public.market_messages FOR SELECT USING (
  auth.uid() IN (
    SELECT buyer_id FROM public.market_chats WHERE id = chat_id
    UNION
    SELECT seller_id FROM public.market_chats WHERE id = chat_id
  )
);
CREATE POLICY "Participants can send messages" ON public.market_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND
  auth.uid() IN (
    SELECT buyer_id FROM public.market_chats WHERE id = chat_id
    UNION
    SELECT seller_id FROM public.market_chats WHERE id = chat_id
  )
);
CREATE POLICY "Participants can update messages" ON public.market_messages FOR UPDATE USING (
  auth.uid() IN (
    SELECT buyer_id FROM public.market_chats WHERE id = chat_id
    UNION
    SELECT seller_id FROM public.market_chats WHERE id = chat_id
  )
);

-- Realtime для сообщений маркета
ALTER PUBLICATION supabase_realtime ADD TABLE public.market_messages;

-- ============================================================
-- ФУНКЦИИ И ТРИГГЕРЫ
-- ============================================================

-- Автосоздание профиля при регистрации
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.phone, NEW.email, NEW.id::text),
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Обновление updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rides_updated_at BEFORE UPDATE ON public.rides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER listings_updated_at BEFORE UPDATE ON public.market_listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Обновление геолокации водителя (обновляет PostGIS поле)
CREATE OR REPLACE FUNCTION public.update_driver_location(
  p_driver_id UUID,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_vehicle_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.driver_status (driver_id, lat, lng, location, is_online, last_seen, vehicle_id)
  VALUES (
    p_driver_id, p_lat, p_lng,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::GEOGRAPHY,
    TRUE, NOW(), p_vehicle_id
  )
  ON CONFLICT (driver_id) DO UPDATE SET
    lat = p_lat, lng = p_lng,
    location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::GEOGRAPHY,
    is_online = TRUE,
    last_seen = NOW(),
    vehicle_id = COALESCE(p_vehicle_id, driver_status.vehicle_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Поиск водителей в радиусе N км
CREATE OR REPLACE FUNCTION public.find_nearby_drivers(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_km DOUBLE PRECISION DEFAULT 15
)
RETURNS TABLE (
  driver_id UUID,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  distance_km DOUBLE PRECISION,
  full_name TEXT,
  rating_driver NUMERIC,
  vehicle_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ds.driver_id,
    ds.lat,
    ds.lng,
    ST_Distance(
      ds.location,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::GEOGRAPHY
    ) / 1000 AS distance_km,
    p.full_name,
    p.rating_driver,
    ds.vehicle_id
  FROM public.driver_status ds
  JOIN public.profiles p ON p.id = ds.driver_id
  WHERE
    ds.is_online = TRUE AND
    ST_DWithin(
      ds.location,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::GEOGRAPHY,
      p_radius_km * 1000
    )
  ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Обновление рейтинга пользователя
CREATE OR REPLACE FUNCTION public.update_user_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role_reviewed = 'driver' THEN
    UPDATE public.profiles SET
      rating_driver = (
        SELECT AVG(rating) FROM public.reviews
        WHERE reviewed_id = NEW.reviewed_id AND role_reviewed = 'driver'
      )
    WHERE id = NEW.reviewed_id;
  ELSE
    UPDATE public.profiles SET
      rating_passenger = (
        SELECT AVG(rating) FROM public.reviews
        WHERE reviewed_id = NEW.reviewed_id AND role_reviewed = 'passenger'
      )
    WHERE id = NEW.reviewed_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rating_on_review
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_user_rating();

-- Счётчик просмотров объявления (доступен без авторизации)
CREATE OR REPLACE FUNCTION public.increment_listing_views(p_listing_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.market_listings
  SET views_count = views_count + 1
  WHERE id = p_listing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
