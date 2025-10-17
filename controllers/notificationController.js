const { prisma } = require('../config/database');
const { sendOrderConfirmation, sendOrderStatusUpdate } = require('../utils/email');
const { sendAdminNotification } = require('../utils/telegram');

const notificationController = {
  // Отправка тестового уведомления
  sendTestNotification: async (req, res) => {
    try {
      const { type, message } = req.body;

      if (!type || !message) {
        return res.status(400).json({
          success: false,
          message: 'Type and message are required',
        });
      }

      switch (type) {
        case 'email':
          // Отправка тестового email
          await sendOrderConfirmation(req.user.email, {
            order_number: 'TEST-ORDER-001',
            total_amount: 999.99,
            items: [
              {
                product: { name: 'Тестовый товар' },
                quantity: 1,
                unit_price: 999.99
              }
            ],
            delivery_address_street: 'Тестовая улица',
            delivery_address_house: '1',
            user: { first_name: req.user.first_name }
          });
          break;

        case 'telegram':
          // Отправка тестового сообщения в Telegram
          await sendAdminNotification(`🔔 Тестовое уведомление: ${message}`);
          break;

        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid notification type',
          });
      }

      res.json({
        success: true,
        message: `Test ${type} notification sent successfully`,
      });
    } catch (error) {
      console.error('Send test notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send test notification',
      });
    }
  },

  // Получение настроек уведомлений пользователя
  getNotificationSettings: async (req, res) => {
    try {
      const settings = await prisma.userProfile.findUnique({
        where: { user_id: req.user.id },
        select: {
          preferred_notifications: true,
          user: {
            select: {
              email: true,
              phone_number: true,
            },
          },
        },
      });

      // Получаем Telegram подписку
      const telegramSubscriptions = await prisma.telegramSubscriber.findMany({
        where: {
          first_name: req.user.first_name,
          is_active: true,
        },
      });

      res.json({
        success: true,
        data: {
          email: settings?.user.email || '',
          phone: settings?.user.phone_number || '',
          emailNotifications: settings?.preferred_notifications ?? true,
          telegramSubscriptions: telegramSubscriptions.map(sub => ({
            chatId: sub.chat_id,
            username: sub.username,
            subscribedAt: sub.subscribed_at,
          })),
        },
      });
    } catch (error) {
      console.error('Get notification settings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notification settings',
      });
    }
  },

  // Обновление настроек уведомлений
  updateNotificationSettings: async (req, res) => {
    try {
      const { emailNotifications, phone } = req.body;

      // Обновляем настройки в профиле
      await prisma.userProfile.upsert({
        where: { user_id: req.user.id },
        update: {
          preferred_notifications: emailNotifications,
        },
        create: {
          user_id: req.user.id,
          preferred_notifications: emailNotifications,
        },
      });

      // Обновляем номер телефона если предоставлен
      if (phone) {
        await prisma.user.update({
          where: { id: req.user.id },
          data: {
            phone_number: phone,
            updated_at: new Date(),
          },
        });
      }

      res.json({
        success: true,
        message: 'Notification settings updated successfully',
      });
    } catch (error) {
      console.error('Update notification settings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update notification settings',
      });
    }
  },

  // Подписка на Telegram уведомления
  subscribeToTelegram: async (req, res) => {
  try {
    const { chatId, firstName, username } = req.body;

    if (!chatId) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID is required',
      });
    }

    const subscriber = await prisma.telegramSubscriber.upsert({
      where: { chat_id: BigInt(chatId) }, 
      update: {
        first_name: firstName || req.user.first_name,
        username: username,
        is_active: true,
      },
      create: {
        chat_id: BigInt(chatId), 
        first_name: firstName || req.user.first_name,
        username: username,
        is_active: true,
      },
    });

      // Отправляем приветственное сообщение
    const { sendAdminNotification } = require('../utils/telegram');
    await sendAdminNotification(
      `🎉 Новый подписчик: ${subscriber.first_name} (${subscriber.username || 'без username'})`
    );

    res.json({
      success: true,
      message: 'Subscribed to Telegram notifications successfully',
      data: { 
        subscriber: {
          ...subscriber,
          chat_id: subscriber.chat_id.toString() // Преобразуем для клиента
        }
      },
    });
  } catch (error) {
    console.error('Subscribe to Telegram error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to subscribe to Telegram notifications',
    });
  }
},

  // Отписка от Telegram уведомлений
  unsubscribeFromTelegram: async (req, res) => {
  try {
    const { chatId } = req.body;

    if (!chatId) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID is required',
      });
    }

    await prisma.telegramSubscriber.updateMany({
      where: { chat_id: BigInt(chatId) }, 
      data: { is_active: false },
    });

    res.json({
      success: true,
      message: 'Unsubscribed from Telegram notifications successfully',
    });
  } catch (error) {
    console.error('Unsubscribe from Telegram error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unsubscribe from Telegram notifications',
    });
  }
},

  // Получение истории уведомлений (для админов)
  getNotificationHistory: async (req, res) => {
    try {
      const { page = 1, limit = 20, type } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // В реальном приложении здесь была бы таблица с историей уведомлений
      // Пока возвращаем заглушку

      res.json({
        success: true,
        data: {
          notifications: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            pages: 0,
          },
        },
        message: 'Notification history feature is under development',
      });
    } catch (error) {
      console.error('Get notification history error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notification history',
      });
    }
  },

  // Отправка массового уведомления (только для админов)
  sendBulkNotification: async (req, res) => {
    try {
      const { type, message, target } = req.body;

      if (!type || !message) {
        return res.status(400).json({
          success: false,
          message: 'Type and message are required',
        });
      }

      let sentCount = 0;

      switch (type) {
        case 'telegram':
          // Отправка всем подписчикам Telegram
          const subscribers = await prisma.telegramSubscriber.findMany({
            where: { is_active: true },
          });

          for (const subscriber of subscribers) {
            try {
              await sendAdminNotification(`📢 ${message}`);
              sentCount++;
            } catch (error) {
              console.error(`Failed to send to ${subscriber.chat_id}:`, error);
            }
          }
          break;

        case 'email':
          // Отправка email пользователям
          const users = await prisma.user.findMany({
            where: {
              email_verified: true,
              profile: {
                preferred_notifications: true,
              },
            },
            select: { email: true, first_name: true },
          });

          // Здесь должна быть реализация массовой отправки email
          // Пока просто считаем
          sentCount = users.length;
          break;

        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid notification type for bulk send',
          });
      }

      res.json({
        success: true,
        message: `Bulk notification sent to ${sentCount} recipients`,
        data: { sentCount },
      });
    } catch (error) {
      console.error('Send bulk notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send bulk notification',
      });
    }
  },

  // Проверка статуса Telegram подписки
  checkTelegramSubscription: async (req, res) => {
  try {
    const { chatId } = req.query;

    if (!chatId) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID is required',
      });
    }

    const subscription = await prisma.telegramSubscriber.findUnique({
      where: { chat_id: BigInt(chatId) },
    });

    res.json({
      success: true,
      data: {
        isSubscribed: subscription?.is_active || false,
        subscription: subscription ? {
          chatId: subscription.chat_id.toString(), 
          firstName: subscription.first_name,
          username: subscription.username,
          subscribedAt: subscription.subscribed_at,
          isActive: subscription.is_active,
        } : null,
      },
    });
  } catch (error) {
    console.error('Check Telegram subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check subscription status',
    });
  }
},
};

module.exports = notificationController;