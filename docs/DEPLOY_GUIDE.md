# 🚗 РидМаркет — Полная инструкция по запуску
## От нуля до рабочего приложения на сервере Beget

---

## 📋 Содержание

1. [Что тебе понадобится](#что-тебе-понадобится)
2. [Шаг 1 — Настройка Supabase (база данных)](#шаг-1--настройка-supabase)
3. [Шаг 2 — Получение ключа Яндекс Карт](#шаг-2--яндекс-карты)
4. [Шаг 3 — Настройка проекта на компьютере](#шаг-3--настройка-на-компьютере)
5. [Шаг 4 — Запуск локально (для тестирования)](#шаг-4--запуск-локально)
6. [Шаг 5 — Деплой на сервер Beget](#шаг-5--деплой-на-beget)
7. [Шаг 6 — Настройка домена и HTTPS](#шаг-6--домен-и-https)
8. [Шаг 7 — Финальная проверка](#шаг-7--финальная-проверка)
9. [Частые проблемы и их решения](#частые-проблемы)

---

## 🛠 Что тебе понадобится

Перед началом убедись, что у тебя есть:

| Что | Где взять | Цена |
|-----|-----------|------|
| Аккаунт Supabase | supabase.com | Бесплатно |
| Аккаунт Яндекс Разработчик | developer.tech.yandex.ru | Бесплатно до лимита |
| VPS на Beget | beget.com/vps | от 299 ₽/мес |
| Домен | reg.ru или nic.ru | от 199 ₽/год |
| Node.js на компьютере | nodejs.org | Бесплатно |
| Git | git-scm.com | Бесплатно |

---

## Шаг 1 — Настройка Supabase

### 1.1 Создаём проект

1. Зайди на **https://supabase.com** и нажми **"Start your project"**
2. Зарегистрируйся через GitHub или email
3. Нажми **"New project"**
4. Заполни:
   - **Name**: `rideshare` (или любое название)
   - **Database Password**: придумай надёжный пароль — **запиши его!**
   - **Region**: выбери `Central Europe (Frankfurt)` — ближайший к России
5. Нажми **"Create new project"** — подождёт 1-2 минуты пока создаётся

### 1.2 Запускаем миграцию базы данных

1. В левом меню найди иконку **"SQL Editor"** (похожа на терминал)
2. Нажми **"New query"**
3. Открой файл `supabase/migrations/001_initial_schema.sql` из проекта
4. Скопируй ВЕСЬ текст файла и вставь в редактор
5. Нажми **"Run"** (или Ctrl+Enter)
6. Должно появиться сообщение **"Success"**

> ⚠️ Если появилась ошибка про `postgis` — это расширение может не быть активно.
> Зайди в **Database → Extensions**, найди **PostGIS** и включи его. Потом снова запусти SQL.

### 1.3 Настраиваем аутентификацию по SMS

1. В левом меню: **Authentication → Providers**
2. Найди **Phone** и нажми на него
3. Включи провайдер (переключатель Enable)
4. **SMS Provider**: выбери **Twilio** (самый простой для начала)
5. Для получения ключей Twilio:
   - Зайди на **twilio.com** → создай бесплатный аккаунт
   - На главной странице Dashboard найди **Account SID** и **Auth Token**
   - В разделе **Phone Numbers** → купи номер (бесплатный тестовый есть)
6. Вставь в Supabase:
   - **Account SID**: вставляй из Twilio
   - **Auth Token**: вставляй из Twilio
   - **Message Service SID** или **From**: номер телефона из Twilio
7. Нажми **Save**

> 💡 **Тест без SMS**: На этапе разработки Supabase позволяет войти через email.
> Или включи **"Enable phone confirmations"** → **OFF**, тогда любой код подойдёт.

### 1.4 Создаём хранилище для файлов

1. В левом меню: **Storage**
2. Нажми **"New bucket"**
3. Создай два бакета:
   - Имя: `avatars`, тип: **Public**
   - Имя: `market`, тип: **Public**
4. Для каждого бакета:
   - Нажми на него → **Policies** → **"New policy"**
   - Выбери **"For full customization"**
   - Разреши INSERT для `authenticated` пользователей
   - Разреши SELECT для `public` (все могут смотреть)

### 1.5 Получаем ключи API

1. В левом меню: **Settings → API**
2. Найди и скопируй:
   - **Project URL** — выглядит как `https://xxxxxxxxxxxx.supabase.co`
   - **anon/public** ключ — длинная строка начинающаяся с `eyJ`
   - **service_role** ключ — тоже длинная строка (держи в секрете!)
3. Сохрани их — понадобятся в следующем шаге

---

## Шаг 2 — Яндекс Карты

### 2.1 Получаем API ключ

1. Зайди на **https://developer.tech.yandex.ru/**
2. Войди через Яндекс аккаунт
3. Нажми **"Подключить API"**
4. Выбери **"JavaScript API и HTTP Геокодер"**
5. Нажми **"Создать"**, заполни:
   - **Название**: РидМаркет
   - **Сайт**: можно написать `localhost` пока нет домена
6. Нажми **Получить ключ**
7. Скопируй ключ — он вида `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

> 📝 Бесплатный лимит: 25 000 запросов в сутки — для старта хватит с большим запасом

---

## Шаг 3 — Настройка на компьютере

### 3.1 Устанавливаем Node.js

1. Зайди на **https://nodejs.org**
2. Скачай версию **LTS** (с надписью "Recommended For Most Users")
3. Установи стандартной установкой
4. Проверь в терминале:
   ```bash
   node --version   # должно показать v20.x.x или выше
   npm --version    # должно показать 10.x.x или выше
   ```

> 💡 **Как открыть терминал**:
> - Windows: нажми Win+R, напиши `cmd`, Enter. Или открой PowerShell.
> - Mac: Finder → Программы → Утилиты → Терминал

### 3.2 Скачиваем проект

Создай папку для проекта, например `C:\projects` или `~/projects`:

```bash
# Создаём папку и переходим в неё
mkdir projects
cd projects

# Если у тебя есть Git — клонируй репозиторий
# (или просто распакуй архив с кодом в эту папку)
```

Если код в архиве — распакуй его так, чтобы структура была:
```
projects/
  rideshare/
    src/
    supabase/
    package.json
    ...
```

### 3.3 Создаём файл с секретами

1. В папке `rideshare` найди файл `.env.example`
2. Скопируй его и назови `.env.local` (с точкой в начале!)
3. Открой `.env.local` в любом текстовом редакторе (Notepad++ или VS Code)
4. Заполни свои данные:

```
NEXT_PUBLIC_SUPABASE_URL=https://твой-проект.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...твой anon ключ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...твой service_role ключ...
NEXT_PUBLIC_YANDEX_MAPS_KEY=твой-ключ-яндекс-карт
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3.4 Устанавливаем зависимости

В терминале, находясь в папке `rideshare`:

```bash
# Устанавливаем все необходимые пакеты
npm install
```

Это займёт 1-2 минуты. В папке появится `node_modules`.

---

## Шаг 4 — Запуск локально

### 4.1 Запускаем режим разработки

```bash
npm run dev
```

После запуска увидишь:
```
▲ Next.js 14.2.5
- Local:        http://localhost:3000
- Environments: .env.local
✓ Ready in 2.3s
```

### 4.2 Открываем в браузере

Открой **http://localhost:3000** — должна появиться страница приложения!

### 4.3 Тестирование авторизации

1. Ты увидишь экран входа — введи свой номер телефона
2. Supabase отправит SMS с кодом
3. Введи код — ты войдёшь в систему
4. Появится экран выбора роли (Пассажир / Водитель)

> ✅ Если всё работает — переходи к деплою на сервер

---

## Шаг 5 — Деплой на Beget

### 5.1 Покупаем VPS на Beget

1. Зайди на **https://beget.com/ru/vps**
2. Выбери план — рекомендую минимум:
   - **CPU**: 1-2 ядра
   - **RAM**: 2 ГБ (для Next.js хватает)
   - **Диск**: 20 ГБ SSD
   - Примерная цена: **600-900 ₽/мес**
3. В разделе ОС выбери **Ubuntu 22.04 LTS**
4. Оплати и дождись письма с данными:
   - IP адрес сервера
   - root пароль

### 5.2 Подключаемся к серверу

**На Windows** — скачай программу **PuTTY** (putty.org):
1. Открой PuTTY
2. В поле **Host Name** введи IP сервера
3. Port: 22, Connection type: SSH
4. Нажми **Open**
5. Введи логин `root`, потом пароль (при вводе пароля символы не видны — это нормально)

**На Mac/Linux** — открой Терминал:
```bash
ssh root@ВАШ_IP_АДРЕС
```

### 5.3 Обновляем сервер и устанавливаем Node.js

После подключения к серверу выполняй команды по одной:

```bash
# Обновляем список пакетов
apt update

# Обновляем установленные пакеты
apt upgrade -y

# Устанавливаем nvm (менеджер версий Node.js)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Применяем настройки nvm (важно!)
source ~/.bashrc

# Устанавливаем Node.js 20
nvm install 20
nvm use 20

# Проверяем
node --version    # должно показать v20.x.x
npm --version
```

### 5.4 Устанавливаем PM2 (менеджер процессов)

PM2 следит за приложением и перезапускает его при падении:

```bash
npm install -g pm2
```

### 5.5 Устанавливаем Nginx (веб-сервер)

```bash
apt install nginx -y
systemctl enable nginx
systemctl start nginx
```

### 5.6 Загружаем код на сервер

**Вариант А — через Git (рекомендуется)**

Если код на GitHub:
```bash
# Устанавливаем git
apt install git -y

# Клонируем проект (замени URL на свой)
git clone https://github.com/твой-аккаунт/rideshare.git /var/www/rideshare
cd /var/www/rideshare
```

**Вариант Б — через FTP/SFTP**

1. Скачай **FileZilla** (filezilla-project.org)
2. Подключись к серверу:
   - Host: sftp://ВАШ_IP
   - Username: root
   - Password: твой пароль
   - Port: 22
3. Перетащи папку `rideshare` в `/var/www/rideshare`

### 5.7 Настраиваем переменные окружения на сервере

```bash
# Переходим в папку проекта
cd /var/www/rideshare

# Создаём файл с переменными
nano .env.local
```

В редакторе nano вставляй (Ctrl+Shift+V или правая кнопка мыши):
```
NEXT_PUBLIC_SUPABASE_URL=https://твой-проект.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_YANDEX_MAPS_KEY=твой-ключ
NEXT_PUBLIC_APP_URL=https://твой-домен.ru
```

Сохраняем: **Ctrl+X**, потом **Y**, потом **Enter**

### 5.8 Собираем и запускаем приложение

```bash
# Устанавливаем зависимости
npm install

# Собираем продакшн-версию (оптимизированная)
npm run build
```

Сборка занимает 1-3 минуты. Увидишь что-то вроде:
```
✓ Compiled successfully
Route (app)                    Size
├ ○ /                         3.2 kB
├ ○ /auth                     4.1 kB
...
```

```bash
# Запускаем через PM2
pm2 start npm --name "rideshare" -- start

# Смотрим статус
pm2 status

# PM2 должен автоматически стартовать после перезагрузки сервера
pm2 startup
pm2 save
```

### 5.9 Настраиваем Nginx как прокси

Nginx будет принимать запросы снаружи и передавать их в Next.js:

```bash
# Открываем конфиг
nano /etc/nginx/sites-available/rideshare
```

Вставляем:
```nginx
server {
    listen 80;
    server_name ВАШ_ДОМЕН.ru www.ВАШ_ДОМЕН.ru;

    # Максимальный размер загружаемых файлов (для фото в маркете)
    client_max_body_size 20M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Таймауты
        proxy_connect_timeout 60s;
        proxy_send_timeout    60s;
        proxy_read_timeout    60s;
    }

    # Статические файлы Next.js
    location /_next/static/ {
        proxy_pass http://localhost:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Сохраняй: **Ctrl+X → Y → Enter**

```bash
# Активируем конфиг
ln -s /etc/nginx/sites-available/rideshare /etc/nginx/sites-enabled/

# Удаляем дефолтный конфиг чтобы не мешал
rm /etc/nginx/sites-enabled/default

# Проверяем конфиг на ошибки
nginx -t
# Должно написать: syntax is ok / test is successful

# Перезапускаем Nginx
systemctl reload nginx
```

---

## Шаг 6 — Домен и HTTPS

### 6.1 Привязываем домен

1. Купи домен на **reg.ru** или **nic.ru**
2. В настройках DNS домена добавь A-запись:
   - **Тип**: A
   - **Имя**: @ (или пусто — это сам домен)
   - **Значение**: IP адрес твоего сервера
   - **TTL**: 3600
3. Добавь ещё одну для www:
   - **Тип**: A или CNAME
   - **Имя**: www
   - **Значение**: IP адрес (или `@` для CNAME)
4. DNS обновляется до 24 часов, обычно быстрее — 30-60 минут

### 6.2 Устанавливаем SSL (HTTPS) — бесплатно

```bash
# Устанавливаем Certbot
apt install certbot python3-certbot-nginx -y

# Получаем сертификат (замени домен на свой!)
certbot --nginx -d ВАШ_ДОМЕН.ru -d www.ВАШ_ДОМЕН.ru
```

Certbot спросит:
1. Email — введи свой
2. Согласиться с условиями — введи `A`
3. Делиться email — можешь ввести `N`
4. Выбрать редирект HTTP → HTTPS — введи `2`

После этого сертификат автоматически установится и настроится!

```bash
# Проверяем, что автообновление работает
certbot renew --dry-run
```

### 6.3 Обновляем переменную APP_URL

```bash
nano /var/www/rideshare/.env.local
# Измени строку:
# NEXT_PUBLIC_APP_URL=https://ВАШ_ДОМЕН.ru

# Пересобираем проект
cd /var/www/rideshare
npm run build
pm2 restart rideshare
```

---

## Шаг 7 — Финальная проверка

### 7.1 Проверяем что всё работает

Открой в браузере **https://ВАШ_ДОМЕН.ru**

Тестируй по чеклисту:
- [ ] Открывается страница входа
- [ ] Можно ввести телефон и получить SMS
- [ ] После входа показывается выбор роли
- [ ] Кабинет пассажира открывается
- [ ] Форма создания заявки работает
- [ ] Кабинет водителя открывается
- [ ] Онлайн/Офлайн переключается
- [ ] Маркет открывается, категории видны
- [ ] Форма объявления работает

### 7.2 Добавляем домен в Supabase

Важно — добавить свой домен в белый список Supabase:

1. Зайди в **Supabase → Authentication → URL Configuration**
2. В поле **Site URL** поставь: `https://ВАШ_ДОМЕН.ru`
3. В **Redirect URLs** добавь:
   - `https://ВАШ_ДОМЕН.ru/**`
   - `http://localhost:3000/**` (для локальной разработки)
4. Нажми **Save**

### 7.3 Полезные команды для управления сервером

```bash
# Посмотреть логи приложения
pm2 logs rideshare

# Перезапустить приложение
pm2 restart rideshare

# Посмотреть использование CPU/RAM
pm2 monit

# Обновить код (если обновлял через Git)
cd /var/www/rideshare
git pull
npm install
npm run build
pm2 restart rideshare

# Посмотреть логи Nginx
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

---

## ❗ Частые проблемы

### Проблема: "Cannot find module" при запуске
```bash
# Решение — переустанови зависимости
cd /var/www/rideshare
rm -rf node_modules
npm install
npm run build
pm2 restart rideshare
```

### Проблема: Сайт не открывается по домену
```bash
# Проверяем, что Nginx работает
systemctl status nginx

# Проверяем конфиг
nginx -t

# Смотрим логи ошибок
tail -50 /var/log/nginx/error.log
```

### Проблема: SMS не приходит
1. Проверь настройки Twilio — может быть недостаточно баланса
2. Зайди в Supabase → Authentication → Logs и посмотри ошибки
3. На тестовом периоде Twilio отправляет только на верифицированные номера

### Проблема: Карта не загружается
1. Проверь NEXT_PUBLIC_YANDEX_MAPS_KEY в .env.local
2. В консоли браузера (F12) посмотри ошибки
3. В Яндекс Developer Console проверь лимиты и допустимые домены

### Проблема: Фото не загружаются в маркете
1. Проверь что бакеты в Supabase Storage созданы и публичные
2. Проверь RLS политики для хранилища
3. В `.env.local` должен быть `SUPABASE_SERVICE_ROLE_KEY`

### Проблема: "Port 3000 is already in use"
```bash
# Останавливаем все процессы PM2
pm2 kill
# Запускаем заново
pm2 start npm --name "rideshare" -- start
```

---

## 🔄 Обновление приложения в будущем

Когда захочешь добавить новые функции или исправить баги:

```bash
# 1. Вносишь изменения в код на компьютере
# 2. Загружаешь на сервер (если через Git — просто git push)
# 3. На сервере:
cd /var/www/rideshare
git pull origin main       # если используешь Git
npm install                # если добавились новые пакеты
npm run build              # пересобираем
pm2 restart rideshare      # перезапускаем
```

---

## 💡 Следующие шаги для развития

После успешного запуска можно добавить:

1. **Push-уведомления** — Firebase Cloud Messaging (бесплатно)
2. **Система оплаты** — ЮKassa или Robokassa
3. **Яндекс Карты в реальном времени** — отслеживание водителя на карте
4. **Чат-бот** — Telegram бот для уведомлений
5. **Мобильное приложение** — React Native (общий код с веб-версией)
6. **Аналитика** — Яндекс Метрика (просто добавить счётчик)

---

*Если что-то не получается — описывай проблему конкретно: что делал, что написал, какое сообщение об ошибке видишь. Вместе разберёмся!*
