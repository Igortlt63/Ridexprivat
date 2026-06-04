-- Заполняем таблицу категорий маркетплейса
-- ON CONFLICT UPDATE — безопасно запускать повторно

INSERT INTO public.market_categories (id, slug, name, icon, sort_order) VALUES
  (1,  'services',     'Услуги',           '🔧', 1),
  (2,  'real_estate',  'Недвижимость',     '🏠', 2),
  (3,  'cargo',        'Грузоперевозки',   '🚛', 3),
  (4,  'special_tech', 'Спецтехника',      '🚜', 4),
  (5,  'hotels',       'Гостиницы',        '🏨', 5),
  (6,  'cars_sale',    'Авто на продажу',  '🚗', 6),
  (7,  'cars_rent',    'Авто в аренду',    '🔑', 7),
  (8,  'spare_parts',  'Запчасти',         '⚙️', 8),
  (9,  'wheels',       'Колёса / шины',    '🛞', 9),
  (10, 'car_wash',     'Автомойки',        '💦', 10),
  (11, 'car_service',  'Автосервисы',      '🔩', 11)
ON CONFLICT (id) DO UPDATE SET
  slug       = EXCLUDED.slug,
  name       = EXCLUDED.name,
  icon       = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order;

-- RLS для категорий — читают все
ALTER TABLE public.market_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Categories viewable by all" ON public.market_categories;
CREATE POLICY "Categories viewable by all" ON public.market_categories
  FOR SELECT USING (TRUE);
