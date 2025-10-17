const express = require('express');
const router = express.Router();
const { handleWebhook } = require('../utils/telegram');
const { handleWebhook: handlePaymentWebhook } = require('../utils/payment');
const { auth } = require('../middleware/auth');

/**
 * @swagger
 * /api/notifications/telegram/webhook:
 *   post:
 *     summary: Telegram bot webhook
 *     tags: [Notifications]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 */
router.post('/telegram/webhook', handleWebhook);

/**
 * @swagger
 * /api/notifications/payment/webhook:
 *   post:
 *     summary: YooKassa payment webhook
 *     tags: [Notifications]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 */
router.post('/payment/webhook', handlePaymentWebhook);

/**
 * @swagger
 * /api/notifications/subscribe:
 *   post:
 *     summary: Subscribe to notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chatId
 *             properties:
 *               chatId:
 *                 type: integer
 *               firstName:
 *                 type: string
 *               username:
 *                 type: string
 *     responses:
 *       200:
 *         description: Subscribed successfully
 */
router.post('/subscribe', auth, async (req, res) => {
  try {
    const { prisma } = require('../config/database');
    const { chatId, firstName, username } = req.body;

    const subscriber = await prisma.telegramSubscriber.upsert({
      where: { chat_id: BigInt(chatId) }, // Используем BigInt
      update: {
        first_name: firstName,
        username: username,
        is_active: true,
      },
      create: {
        chat_id: BigInt(chatId), // Используем BigInt
        first_name: firstName,
        username: username,
      },
    });

    res.json({
      success: true,
      message: 'Subscribed to notifications successfully',
      data: { 
        subscriber: {
          ...subscriber,
          chat_id: subscriber.chat_id.toString() // Преобразуем для клиента
        }
      },
    });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * @swagger
 * /api/notifications/unsubscribe:
 *   post:
 *     summary: Unsubscribe from notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chatId
 *             properties:
 *               chatId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Unsubscribed successfully
 */
router.post('/unsubscribe', auth, async (req, res) => {
  try {
    const { prisma } = require('../config/database');
    const { chatId } = req.body;

    await prisma.telegramSubscriber.updateMany({
      where: { chat_id: BigInt(chatId) }, // Используем BigInt
      data: { is_active: false },
    });

    res.json({
      success: true,
      message: 'Unsubscribed from notifications successfully',
    });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

module.exports = router;