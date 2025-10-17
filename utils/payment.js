const axios = require('axios');

// ЮKassa API конфигурация
const YOOKASSA_SHOP_ID = process.env.YOOKASSA_SHOP_ID;
const YOOKASSA_SECRET_KEY = process.env.YOOKASSA_SECRET_KEY;
const YOOKASSA_API_URL = 'https://api.yookassa.ru/v3';

// Создаем axios instance для ЮKassa API
const yookassaApi = axios.create({
  baseURL: YOOKASSA_API_URL,
  auth: {
    username: YOOKASSA_SHOP_ID,
    password: YOOKASSA_SECRET_KEY,
  },
  headers: {
    'Idempotence-Key': () => require('crypto').randomUUID(),
  },
});

const paymentUtils = {
  // Создание платежа
  createPayment: async (order, user) => {
    try {
      const paymentData = {
        amount: {
          value: order.total_amount.toFixed(2),
          currency: 'RUB',
        },
        capture: true,
        confirmation: {
          type: 'redirect',
          return_url: `${process.env.CLIENT_URL}/order-success/${order.id}`,
        },
        description: `Заказ #${order.order_number}`,
        metadata: {
          order_id: order.id,
          order_number: order.order_number,
          user_id: user.id,
          user_email: user.email,
        },
        receipt: {
          customer: {
            email: user.email,
            phone: user.phone_number,
          },
          items: order.items.map(item => ({
            description: item.product.name,
            quantity: item.quantity.toString(),
            amount: {
              value: (item.unit_price * item.quantity).toFixed(2),
              currency: 'RUB',
            },
            vat_code: '1', // НДС 20%
            payment_mode: 'full_payment',
            payment_subject: 'commodity',
          })),
        },
      };

      const response = await yookassaApi.post('/payments', paymentData);
      return response.data;
    } catch (error) {
      console.error('Error creating payment:', error.response?.data || error.message);
      throw new Error('Payment creation failed');
    }
  },

  // Подтверждение платежа
  capturePayment: async (paymentId) => {
    try {
      const response = await yookassaApi.post(`/payments/${paymentId}/capture`);
      return response.data;
    } catch (error) {
      console.error('Error capturing payment:', error.response?.data || error.message);
      throw new Error('Payment capture failed');
    }
  },

  // Отмена платежа
  cancelPayment: async (paymentId) => {
    try {
      const response = await yookassaApi.post(`/payments/${paymentId}/cancel`);
      return response.data;
    } catch (error) {
      console.error('Error canceling payment:', error.response?.data || error.message);
      throw new Error('Payment cancellation failed');
    }
  },

  // Получение информации о платеже
  getPayment: async (paymentId) => {
    try {
      const response = await yookassaApi.get(`/payments/${paymentId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting payment:', error.response?.data || error.message);
      throw new Error('Payment info retrieval failed');
    }
  },

  // Обработка вебхука от ЮKassa
  handleWebhook: async (req, res) => {
    try {
      const { event, object } = req.body;

      if (!event || !object) {
        return res.status(400).json({ error: 'Invalid webhook data' });
      }

      const { prisma } = require('../config/database');

      // Находим заказ по metadata из платежа
      const order = await prisma.order.findFirst({
        where: {
          payment_id: object.id,
        },
        include: {
          user: true,
        },
      });

      if (!order) {
        console.error('Order not found for payment:', object.id);
        return res.status(404).json({ error: 'Order not found' });
      }

      switch (event) {
        case 'payment.waiting_for_capture':
          // Платеж ожидает подтверждения
          await prisma.order.update({
            where: { id: order.id },
            data: {
              payment_status: 'processing',
              updated_at: new Date(),
            },
          });
          break;

        case 'payment.succeeded':
          // Платеж успешно завершен
          await prisma.order.update({
            where: { id: order.id },
            data: {
              payment_status: 'paid',
              status: 'confirmed', // Меняем статус заказа на подтвержденный
              updated_at: new Date(),
            },
          });

          // Отправляем уведомления
          const { sendOrderConfirmation, sendOrderStatusUpdate } = require('./email');
          const { sendNewOrderNotification } = require('./telegram');

          await sendOrderConfirmation(order.user.email, order);
          await sendOrderStatusUpdate(order.user.email, order, 'confirmed');
          await sendNewOrderNotification(order);
          break;

        case 'payment.canceled':
          // Платеж отменен
          await prisma.order.update({
            where: { id: order.id },
            data: {
              payment_status: 'failed',
              status: 'cancelled',
              updated_at: new Date(),
            },
          });
          break;

        case 'refund.succeeded':
          // Возврат успешно выполнен
          await prisma.order.update({
            where: { id: order.id },
            data: {
              payment_status: 'refunded',
              updated_at: new Date(),
            },
          });
          break;
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error('Webhook handling error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Создание возврата
  createRefund: async (paymentId, amount, reason = '') => {
    try {
      const refundData = {
        payment_id: paymentId,
        amount: {
          value: amount.toFixed(2),
          currency: 'RUB',
        },
        description: reason,
      };

      const response = await yookassaApi.post('/refunds', refundData);
      return response.data;
    } catch (error) {
      console.error('Error creating refund:', error.response?.data || error.message);
      throw new Error('Refund creation failed');
    }
  },
};

module.exports = paymentUtils;

