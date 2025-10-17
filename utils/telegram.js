const TelegramBot = require('node-telegram-bot-api');
const { prisma } = require('../config/database');

console.log('🔧 Initializing Telegram bot...');
console.log('Token exists:', !!process.env.TELEGRAM_BOT_TOKEN);

// Проверка токена
if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is required');
}

// Инициализация бота с polling
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { 
  polling: true 
});

// Обработчики команд через polling
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  console.log('📨 /start command from:', msg.from.first_name, 'chatId:', chatId);

  try {
    await prisma.telegramSubscriber.upsert({
      where: { chat_id: chatId },
      update: {
        first_name: msg.from.first_name,
        username: msg.from.username,
        is_active: true,
      },
      create: {
        chat_id: chatId,
        first_name: msg.from.first_name,
        username: msg.from.username,
      },
    });

    await bot.sendMessage(chatId, 
      `👋 Привет, ${msg.from.first_name}!\n\n` +
      `Вы подписались на уведомления от Dessert Shop. ` +
      `Здесь вы будете получать информацию о новых заказах и статусах.`,
      { parse_mode: 'HTML' }
    );
    
    console.log('✅ User subscribed successfully');
  } catch (error) {
    console.error('❌ Error in /start:', error);
    try {
      await bot.sendMessage(chatId, 
        '❌ Произошла ошибка при подписке. Пожалуйста, попробуйте позже.'
      );
    } catch (sendError) {
      console.error('❌ Failed to send error message:', sendError);
    }
  }
});

bot.onText(/\/stop/, async (msg) => {
  const chatId = msg.chat.id;
  console.log('📨 /stop command from:', msg.from.first_name);

  try {
    await prisma.telegramSubscriber.updateMany({
      where: { chat_id: chatId },
      data: { is_active: false },
    });

    await bot.sendMessage(chatId, 
      'Вы отписались от уведомлений. Чтобы снова подписаться, отправьте /start',
      { parse_mode: 'HTML' }
    );
    
    console.log('✅ User unsubscribed successfully');
  } catch (error) {
    console.error('❌ Error in /stop:', error);
    try {
      await bot.sendMessage(chatId, 
        '❌ Произошла ошибка при отписке. Пожалуйста, попробуйте позже.'
      );
    } catch (sendError) {
      console.error('❌ Failed to send error message:', sendError);
    }
  }
});

bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  console.log('📨 /help command from:', msg.from.first_name);

  try {
    await bot.sendMessage(chatId,
      `📋 <b>Доступные команды:</b>\n\n` +
      `/start - Подписаться на уведомления\n` +
      `/stop - Отписаться от уведомлений\n` +
      `/help - Показать эту справку\n\n` +
      `🤖 Этот бот отправляет уведомления о новых заказах и изменениях статусов.`,
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    console.error('❌ Error in /help:', error);
  }
});

// Обработчик ошибок
bot.on('polling_error', (error) => {
  console.error('❌ Polling error:', error);
});

bot.on('error', (error) => {
  console.error('❌ Bot error:', error);
});

const telegramUtils = {
  // Отправка уведомления администраторам
  sendAdminNotification: async (message) => {
    try {
      console.log('📢 Sending admin notification...');
      
      const subscribers = await prisma.telegramSubscriber.findMany({
        where: { is_active: true },
      });

      console.log(`📋 Active subscribers: ${subscribers.length}`);

      if (subscribers.length === 0) {
        console.log('📭 No active subscribers found');
        return;
      }

      // Отправка уведомлений батчами для избежания блокировок
      const BATCH_SIZE = 5;
      for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
        const batch = subscribers.slice(i, i + BATCH_SIZE);
        
        await Promise.allSettled(batch.map(async (subscriber) => {
          try {
            await bot.sendMessage(subscriber.chat_id, message, {
              parse_mode: 'HTML',
            });
            console.log(`✅ Notification sent to ${subscriber.first_name} (${subscriber.chat_id})`);
          } catch (error) {
            console.error(`❌ Failed to send to ${subscriber.chat_id}:`, error.message);
            
            // Деактивируем подписчика, если бот заблокирован
            if (error.response?.statusCode === 403) {
              await prisma.telegramSubscriber.update({
                where: { id: subscriber.id },
                data: { is_active: false },
              });
              console.log(`🚫 Subscriber ${subscriber.chat_id} deactivated (bot was blocked)`);
            } else if (error.response?.statusCode === 400) {
              console.error(`❌ Bad request for ${subscriber.chat_id} - check message format`);
            } else if (error.response?.statusCode === 429) {
              console.error(`❌ Rate limit exceeded for ${subscriber.chat_id}`);
              // Ждем перед следующей попыткой
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }));

        // Задержка между батчами
        if (i + BATCH_SIZE < subscribers.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      console.error('❌ Error sending Telegram notification:', error);
    }
  },

  // Уведомление о новом заказе
  sendNewOrderNotification: async (order) => {
    try {
      if (!order || !order.user) {
        console.error('❌ Invalid order data for notification');
        return;
      }

      const message = `
🆕 <b>Новый заказ!</b>

📦 Номер: ${order.order_number}
👤 Клиент: ${order.user.first_name}
📞 Телефон: ${order.user.phone_number || 'Не указан'}
💰 Сумма: ${order.total_amount?.toFixed(2) || '0.00'} ₽
📍 Адрес: ${order.delivery_address_street || 'Не указан'}, ${order.delivery_address_house || 'Не указан'}
${order.delivery_address_apartment ? `🏠 Квартира: ${order.delivery_address_apartment}` : ''}

📋 Товары:
${order.items?.map(item => `• ${item.product?.name || 'Товар'} x ${item.quantity}`).join('\n') || '• Товары не указаны'}
      `.trim();

      await telegramUtils.sendAdminNotification(message);
    } catch (error) {
      console.error('❌ Error in sendNewOrderNotification:', error);
    }
  },

  // Уведомление об изменении статуса заказа
  sendOrderStatusNotification: async (order, oldStatus, newStatus) => {
    try {
      if (!order || !order.user) {
        console.error('❌ Invalid order data for status notification');
        return;
      }

      const statusIcons = {
        'confirmed': '✅',
        'preparing': '👨‍🍳',
        'ready_for_delivery': '📦',
        'out_for_delivery': '🚗',
        'delivered': '🎉',
        'cancelled': '❌',
      };

      const message = `
${statusIcons[newStatus] || '📝'} <b>Статус заказа изменен</b>

📦 Заказ: ${order.order_number}
🔄 Статус: ${oldStatus} → ${newStatus}
👤 Клиент: ${order.user.first_name}
      `.trim();

      await telegramUtils.sendAdminNotification(message);
    } catch (error) {
      console.error('❌ Error in sendOrderStatusNotification:', error);
    }
  },

  // Уведомление о низком количестве товара
  sendLowStockNotification: async (product) => {
    try {
      if (!product) {
        console.error('❌ Invalid product data for stock notification');
        return;
      }

      const message = `
⚠️ <b>Низкий запас товара</b>

📦 Товар: ${product.name}
🏷️ Категория: ${product.category?.name || 'Не указана'}
📊 Текущий остаток: ${product.stock_quantity || 0}

Рекомендуется пополнить запасы.
      `.trim();

      await telegramUtils.sendAdminNotification(message);
    } catch (error) {
      console.error('❌ Error in sendLowStockNotification:', error);
    }
  },

  // Обработчик вебхука (для обратной совместимости)
  handleWebhook: async (req, res) => {
    try {
      console.log('🔔 Webhook called but using polling mode');
      
      res.status(200).json({ 
        success: true, 
        message: 'Bot is using polling mode. Webhook is not active.',
        mode: 'polling'
      });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  },

  // Получить статистику подписчиков
  getSubscriberStats: async () => {
    try {
      const total = await prisma.telegramSubscriber.count();
      const active = await prisma.telegramSubscriber.count({
        where: { is_active: true }
      });
      
      return { total, active };
    } catch (error) {
      console.error('❌ Error getting subscriber stats:', error);
      return { total: 0, active: 0 };
    }
  }
};

// Простая функция для отправки уведомлений
const sendTelegramNotification = (message) => {
  return telegramUtils.sendAdminNotification(message);
};

// Тестовая функция для проверки бота
const testBot = async () => {
  console.log('🧪 Testing bot connection...');
  
  try {
    const me = await bot.getMe();
    console.log('✅ Bot is working! Username:', me.username);
    
    // Получим статистику подписчиков
    const stats = await telegramUtils.getSubscriberStats();
    console.log(`📋 Subscribers: ${stats.active} active, ${stats.total} total`);
    
    return {
      bot: {
        username: me.username,
        first_name: me.first_name,
        is_bot: me.is_bot
      },
      subscribers: stats
    };
  } catch (error) {
    console.error('❌ Bot test failed:', error.message);
    throw error;
  }
};

// Функция для отправки тестового уведомления
const sendTestNotification = async () => {
  try {
    const testMessage = `
🧪 <b>Тестовое уведомление</b>

Это тестовое сообщение для проверки работы бота.

✅ Бот работает корректно!
⏰ Время: ${new Date().toLocaleString('ru-RU')}
    `.trim();

    await telegramUtils.sendAdminNotification(testMessage);
    console.log('✅ Test notification sent');
  } catch (error) {
    console.error('❌ Failed to send test notification:', error);
  }
};

// Вызываем тест при запуске
setTimeout(async () => {
  try {
    await testBot();
    
    // Отправляем тестовое уведомление при запуске (опционально)
    // await sendTestNotification();
    
  } catch (error) {
    console.error('❌ Bot initialization failed:', error.message);
  }
}, 2000);

console.log('✅ Telegram bot setup completed');

module.exports = { 
  ...telegramUtils, 
  sendTelegramNotification, 
  bot,
  testBot,
  sendTestNotification
};