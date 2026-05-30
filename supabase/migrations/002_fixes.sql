-- ============================================================
-- RIDESHARE APP — Исправления для уже развёрнутых баз
-- Запусти в Supabase SQL Editor если 001 уже был применён ранее
-- ============================================================

-- 1. Триггер профиля: поддержка email-регистрации
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

-- 2. Таблицы чатов маркета
CREATE TABLE IF NOT EXISTS public.market_chats (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id      UUID NOT NULL REFERENCES public.market_listings(id) ON DELETE CASCADE,
  buyer_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_message    TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, buyer_id)
);

CREATE TABLE IF NOT EXISTS public.market_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id     UUID NOT NULL REFERENCES public.market_chats(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES public.profiles(id),
  message     TEXT NOT NULL,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_messages_chat ON public.market_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_market_chats_buyer ON public.market_chats(buyer_id);
CREATE INDEX IF NOT EXISTS idx_market_chats_seller ON public.market_chats(seller_id);

-- 3. RLS — автомобили водителей
ALTER TABLE public.driver_vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Vehicles viewable by all" ON public.driver_vehicles;
DROP POLICY IF EXISTS "Drivers manage own vehicles" ON public.driver_vehicles;
CREATE POLICY "Vehicles viewable by all" ON public.driver_vehicles FOR SELECT USING (TRUE);
CREATE POLICY "Drivers manage own vehicles" ON public.driver_vehicles FOR ALL USING (auth.uid() = driver_id);

-- 4. RLS — отзывы
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reviews viewable by all" ON public.reviews;
DROP POLICY IF EXISTS "Users can create reviews" ON public.reviews;
CREATE POLICY "Reviews viewable by all" ON public.reviews FOR SELECT USING (TRUE);
CREATE POLICY "Users can create reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- 5. RLS — избранное
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own favorites" ON public.favorites;
CREATE POLICY "Users manage own favorites" ON public.favorites FOR ALL USING (auth.uid() = user_id);

-- 6. RLS — чаты и сообщения маркета
ALTER TABLE public.market_chats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Chat participants can view" ON public.market_chats;
DROP POLICY IF EXISTS "Buyers can create chats" ON public.market_chats;
DROP POLICY IF EXISTS "Participants can update chats" ON public.market_chats;
CREATE POLICY "Chat participants can view" ON public.market_chats FOR SELECT USING (
  auth.uid() = buyer_id OR auth.uid() = seller_id
);
CREATE POLICY "Buyers can create chats" ON public.market_chats FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Participants can update chats" ON public.market_chats FOR UPDATE USING (
  auth.uid() = buyer_id OR auth.uid() = seller_id
);

ALTER TABLE public.market_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Chat participants can view messages" ON public.market_messages;
DROP POLICY IF EXISTS "Participants can send messages" ON public.market_messages;
DROP POLICY IF EXISTS "Participants can update messages" ON public.market_messages;
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

-- 7. Realtime для сообщений маркета
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.market_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 8. Счётчик просмотров объявлений
CREATE OR REPLACE FUNCTION public.increment_listing_views(p_listing_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.market_listings
  SET views_count = views_count + 1
  WHERE id = p_listing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
