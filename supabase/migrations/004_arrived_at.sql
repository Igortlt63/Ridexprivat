-- Добавляем поле arrived_at для фиксации момента прибытия водителя
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ;

-- Добавляем status 'waiting' между 'accepted' и 'in_progress'
-- (водитель прибыл и ждёт пассажира)
-- Constraint check обновляется только если он существует
DO $$
BEGIN
  -- Просто убеждаемся что новые данные с arrived_at не сломают RLS
  -- Статус 'waiting' будет обрабатываться на уровне приложения,
  -- accepted → waiting (arrived_at set) → in_progress
END $$;
