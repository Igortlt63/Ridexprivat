-- ============================================================
-- Динамические рейтинги: триггер пересчёта после каждого отзыва
-- + счётчики завершённых поездок
-- ============================================================

-- Функция пересчёта рейтинга профиля
CREATE OR REPLACE FUNCTION update_profile_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role_reviewed = 'driver' THEN
    UPDATE public.profiles
    SET rating_driver = (
      SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 5.00)
      FROM public.reviews
      WHERE reviewed_id = NEW.reviewed_id
        AND role_reviewed = 'driver'
    )
    WHERE id = NEW.reviewed_id;

  ELSIF NEW.role_reviewed = 'passenger' THEN
    UPDATE public.profiles
    SET rating_passenger = (
      SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 5.00)
      FROM public.reviews
      WHERE reviewed_id = NEW.reviewed_id
        AND role_reviewed = 'passenger'
    )
    WHERE id = NEW.reviewed_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Удаляем старый триггер если существовал
DROP TRIGGER IF EXISTS trigger_update_rating ON public.reviews;

CREATE TRIGGER trigger_update_rating
AFTER INSERT ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION update_profile_rating();

-- ============================================================
-- Функция пересчёта счётчиков поездок при завершении
-- ============================================================
CREATE OR REPLACE FUNCTION update_ride_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Поездка только что завершилась
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    -- Счётчик пассажира
    UPDATE public.profiles
    SET total_rides_as_passenger = total_rides_as_passenger + 1
    WHERE id = NEW.passenger_id;

    -- Счётчик водителя
    IF NEW.driver_id IS NOT NULL THEN
      UPDATE public.profiles
      SET total_rides_as_driver = total_rides_as_driver + 1
      WHERE id = NEW.driver_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_ride_counts ON public.rides;

CREATE TRIGGER trigger_update_ride_counts
AFTER UPDATE ON public.rides
FOR EACH ROW
EXECUTE FUNCTION update_ride_counts();

-- ============================================================
-- Уникальный отзыв: один пользователь — один отзыв за поездку
-- ============================================================
ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_ride_reviewer_unique;

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_ride_reviewer_unique
  UNIQUE (ride_id, reviewer_id);
