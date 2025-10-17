const { prisma } = require('../config/database');
const { sendOrderConfirmation } = require('../utils/email');
const { sendTelegramNotification } = require('../utils/telegram');
const { createPayment } = require('../utils/payment');

const generateOrderNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `ORD-${year}${month}${day}-${random}`;
};

const orderController = {
  // Создание заказа
  createOrder: async (req, res) => {
    try {
      const {
        items,
        deliveryAddress,
        paymentMethod,
        deliveryComment,
      } = req.body;

      if (!items || !items.length) {
        return res.status(400).json({
          success: false,
          message: 'Order must contain at least one item',
        });
      }

      if (!deliveryAddress) {
        return res.status(400).json({
          success: false,
          message: 'Delivery address is required',
        });
      }

      // Проверяем наличие товаров и рассчитываем итоговую сумму
      let totalAmount = 0;
      const orderItems = [];

      for (const item of items) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          return res.status(400).json({
            success: false,
            message: `Product with ID ${item.productId} not found`,
          });
        }

        if (product.status !== 'active') {
          return res.status(400).json({
            success: false,
            message: `Product "${product.name}" is not available`,
          });
        }

        const itemTotal = product.price * item.quantity;
        totalAmount += itemTotal;

        orderItems.push({
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: product.price,
          item_total: itemTotal, 
        });
      }

      // Создаем заказ
      const order = await prisma.order.create({
        data: {
          order_number: generateOrderNumber(),
          user_id: req.user.id,
          total_amount: totalAmount,
          delivery_address_street: deliveryAddress.street,
          delivery_address_house: deliveryAddress.houseNumber,
          delivery_address_apartment: deliveryAddress.apartmentNumber,
          delivery_address_floor: deliveryAddress.floor,
          delivery_address_entrance: deliveryAddress.entrance,
          delivery_address_doorcode: deliveryAddress.doorcode,
          delivery_comment: deliveryComment,
          payment_method: paymentMethod,
          items: {
            create: orderItems,
          },
        },
        include: {
          items: {
            include: {
              product: {
                include: {
                  images: {
                    orderBy: { sort_order: 'asc' },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      });

      // Обновляем счетчики покупок для товаров
      for (const item of items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            purchase_count: { increment: item.quantity },
          },
        });
      }

      // Отправляем уведомления
      try {
        await sendOrderConfirmation(req.user.email, order);
        await sendTelegramNotification(`Новый заказ #${order.order_number} от ${req.user.first_name}`);
      } catch (notificationError) {
        console.error('Notification error:', notificationError);
        // Не прерываем выполнение из-за ошибки уведомлений
      }

      // // Если оплата картой, создаем платеж в ЮKassa
      // if (paymentMethod === 'card') {
      //   const payment = await createPayment(order, req.user);
      //   await prisma.order.update({
      //     where: { id: order.id },
      //     data: {
      //       payment_id: payment.id,
      //     },
      //   });

      //   return res.status(201).json({
      //     success: true,
      //     message: 'Order created successfully',
      //     data: {
      //       order,
      //       payment: {
      //         id: payment.id,
      //         confirmationUrl: payment.confirmation.confirmation_url,
      //       },
      //     },
      //   });
      // }

      res.status(201).json({
        success: true,
        message: 'Order created successfully',
        data: { order },
      });
    } catch (error) {
      console.error('Create order error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },

  // Получение истории заказов пользователя
  getOrderHistory: async (req, res) => {
    try {
      const { page = 1, limit = 10, status } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const where = {
        user_id: req.user.id,
      };

      if (status) {
        where.status = status;
      }

      const orders = await prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: {
                include: {
                  images: {
                    orderBy: { sort_order: 'asc' },
                    take: 1,
                  },
                },
              },
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        skip,
        take: parseInt(limit),
      });

      const total = await prisma.order.count({ where });

      res.json({
        success: true,
        data: {
          orders,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit)),
          },
        },
      });
    } catch (error) {
      console.error('Get order history error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },

  // Получение деталей заказа
  getOrder: async (req, res) => {
    try {
      const { id } = req.params;

      const order = await prisma.order.findFirst({
        where: {
          id: parseInt(id),
          user_id: req.user.id,
        },
        include: {
          items: {
            include: {
              product: {
                include: {
                  images: {
                    orderBy: { sort_order: 'asc' },
                  },
                },
              },
            },
          },
        },
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found',
        });
      }

      res.json({
        success: true,
        data: { order },
      });
    } catch (error) {
      console.error('Get order error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },

  // Отмена заказа
  cancelOrder: async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const order = await prisma.order.findFirst({
        where: {
          id: parseInt(id),
          user_id: req.user.id,
        },
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found',
        });
      }

      // Можно отменять только заказы в определенных статусах
      const cancellableStatuses = ['pending', 'confirmed'];
      if (!cancellableStatuses.includes(order.status)) {
        return res.status(400).json({
          success: false,
          message: 'Order cannot be cancelled at this stage',
        });
      }

      const updatedOrder = await prisma.order.update({
        where: { id: parseInt(id) },
        data: {
          status: 'cancelled',
          updated_at: new Date(),
        },
      });

      // Здесь можно добавить логику возврата платежа, если оплата была картой

      res.json({
        success: true,
        message: 'Order cancelled successfully',
        data: { order: updatedOrder },
      });
    } catch (error) {
      console.error('Cancel order error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },

  // Подтверждение получения заказа
  confirmDelivery: async (req, res) => {
    try {
      const { id } = req.params;

      const order = await prisma.order.findFirst({
        where: {
          id: parseInt(id),
          user_id: req.user.id,
          status: 'out_for_delivery',
        },
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found or cannot be confirmed',
        });
      }

      const updatedOrder = await prisma.order.update({
        where: { id: parseInt(id) },
        data: {
          status: 'delivered',
          updated_at: new Date(),
        },
      });

      res.json({
        success: true,
        message: 'Delivery confirmed successfully',
        data: { order: updatedOrder },
      });
    } catch (error) {
      console.error('Confirm delivery error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },
};

module.exports = orderController;