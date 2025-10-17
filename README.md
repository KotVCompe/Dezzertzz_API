```# Dezzertzz API 🍰

Бэкенд-часть для интернет-магазина десертов. REST API предоставляет функционал для аутентификации пользователей, управления каталогом товаров, обработки заказов и онлайн-платежей.

## 📋 Предварительные требования

Перед началом убедитесь, что у вас установлены:

- Node.js (версия 18 или выше)
- npm или yarn
- PostgreSQL или другая совместимая СУБД

## ⚡ Быстрый старт

Следуйте этим шагам, чтобы запустить проект локально для разработки и тестирования.

### 1. Клонирование репозитория

bash
git clone https://github.com/your-username/Dezzertzz_API.git
cd Dezzertzz_API

2. Установка зависимостей
```bash
npm install
3. Настройка переменных окружения
Создайте файл .env в корневой директории проекта.

Используйте пример ниже. Заполните все переменные своими реальными данными.

Пример файла .env:

env
# Сервер
NODE_ENV=development
PORT=5000
API_URL=http://localhost:5000/
CLIENT_URL=http://localhost:3000

# База данных (ОБЯЗАТЕЛЬНО ЗАПОЛНИТЕ)
DATABASE_URL="postgresql://username:password@localhost:5432/dezzertzz_db?schema=public"

# JWT (СГЕНЕРИРУЙТЕ СЕКРЕТНЫЙ КЛЮЧ)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Лимит запросов (например, для авторизации)
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX_REQUESTS=5

# Email (Выберите один из вариантов: SendGrid ИЛИ Gmail)

# Вариант A: SendGrid
# SMTP_HOST=smtp.sendgrid.net
# SMTP_PORT=587
# SMTP_USER=apikey
# SMTP_PASSWORD=SG.your_actual_sendgrid_api_key_here
# EMAIL_FROM=noreply@dessertshop.com

# Вариант B: Gmail (рекомендуется для разработки)
GMAIL_USER=your.email@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password

# Платежи (YooKassa)
YOOKASSA_SHOP_ID=your-shop-id
YOOKASSA_SECRET_KEY=your-secret-key

# Telegram бот
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# AWS S3 (для загрузки изображений)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_BUCKET_NAME=your-bucket-name

# Twilio (SMS уведомления)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number
4. Настройка базы данных
Убедитесь, что ваша база данных PostgreSQL запущена.

Выполните миграции Prisma для создания схемы БД:

bash
npx prisma generate
npx prisma db push
# Или, если используете миграции: npx prisma migrate dev --name init
5. Запуск приложения
Режим разработки:

bash
npm run dev
Обычный запуск:

bash
npm start
После успешного запуска API будет доступно по адресу: http://localhost:5000

📚 Документация API
После запуска сервера документация API будет доступна по адресу:
http://localhost:5000/api/docs

🗄️ Структура базы данных
Для просмотра и редактирования данных в реальном времени используйте Prisma Studio:

bash
npx prisma studio
Он откроется в браузере по адресу http://localhost:5555.
