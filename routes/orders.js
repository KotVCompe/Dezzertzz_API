const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { auth, adminAuth } = require('../middleware/auth');

/**
 * @swagger
 * components:
 *   schemas:
 *     Order:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         orderNumber:
 *           type: string
 *         userId:
 *           type: integer
 *         status:
 *           type: string
 *         totalAmount:
 *           type: number
 *           format: float
 *         deliveryAddress:
 *           type: object
 *         paymentMethod:
 *           type: string
 *         paymentStatus:
 *           type: string
 *     OrderItem:
 *       type: object
 *       properties:
 *         productId:
 *           type: integer
 *         quantity:
 *           type: integer
 *         unitPrice:
 *           type: number
 *           format: float
 */

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Create new order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *               - deliveryAddress
 *               - paymentMethod
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/OrderItem'
 *               deliveryAddress:
 *                 type: object
 *                 required:
 *                   - street
 *                   - houseNumber
 *                 properties:
 *                   street:
 *                     type: string
 *                   houseNumber:
 *                     type: string
 *                   apartmentNumber:
 *                     type: string
 *                   floor:
 *                     type: integer
 *                   entrance:
 *                     type: string
 *                   doorcode:
 *                     type: string
 *               paymentMethod:
 *                 type: string
 *                 enum: [card, cash]
 *               deliveryComment:
 *                 type: string
 *     responses:
 *       201:
 *         description: Order created successfully
 */
router.post('/', auth, orderController.createOrder);

/**
 * @swagger
 * /api/orders/history:
 *   get:
 *     summary: Get user's order history
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of orders per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: Order history retrieved successfully
 */
router.get('/history', auth, orderController.getOrderHistory);

/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     summary: Get order by ID
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Order retrieved successfully
 *       404:
 *         description: Order not found
 */
router.get('/:id', auth, orderController.getOrder);

/**
 * @swagger
 * /api/orders/{id}/cancel:
 *   post:
 *     summary: Cancel order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Order cancelled successfully
 */
router.post('/:id/cancel', auth, orderController.cancelOrder);

/**
 * @swagger
 * /api/orders/{id}/confirm-delivery:
 *   post:
 *     summary: Confirm order delivery
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Delivery confirmed successfully
 */
router.post('/:id/confirm-delivery', auth, orderController.confirmDelivery);

// Admin routes
/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: Get all orders (Admin only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Orders retrieved successfully
 */
router.get('/', adminAuth, async (req, res) => {
  try {
    const { prisma } = require('../config/database');
    const { page = 1, limit = 20, status, userId } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (status) where.status = status;
    if (userId) where.user_id = parseInt(userId);

    const orders = await prisma.order.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            email: true,
            phone_number: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
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
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * @swagger
 * /api/orders/{id}/status:
 *   put:
 *     summary: Update order status (Admin only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, confirmed, preparing, ready_for_delivery, out_for_delivery, delivered, cancelled]
 *     responses:
 *       200:
 *         description: Order status updated successfully
 */
router.put('/:id/status', adminAuth, async (req, res) => {
  try {
    const { prisma } = require('../config/database');
    const { status } = req.body;

    const order = await prisma.order.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { user: true },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const oldStatus = order.status;
    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(req.params.id) },
      data: { status, updated_at: new Date() },
    });

    // Отправляем уведомления
    try {
      const { sendOrderStatusUpdate } = require('../utils/email');
      const { sendOrderStatusNotification } = require('../utils/telegram');

      await sendOrderStatusUpdate(order.user.email, order, status);
      await sendOrderStatusNotification(order, oldStatus, status);
    } catch (notificationError) {
      console.error('Notification error:', notificationError);
    }

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: { order: updatedOrder },
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

module.exports = router;