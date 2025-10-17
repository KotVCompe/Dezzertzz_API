const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { auth } = require('../middleware/auth');
const { uploadAvatar } = require('../middleware/upload');

/**
 * @swagger
 * components:
 *   schemas:
 *     UserProfile:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         userId:
 *           type: integer
 *         dateOfBirth:
 *           type: string
 *           format: date
 *         preferredNotifications:
 *           type: boolean
 *     UserAddress:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         title:
 *           type: string
 *         street:
 *           type: string
 *         houseNumber:
 *           type: string
 *         apartmentNumber:
 *           type: string
 *         floor:
 *           type: integer
 *         entrance:
 *           type: string
 *         doorcode:
 *           type: string
 *         comment:
 *           type: string
 *         isPrimary:
 *           type: boolean
 */

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 */
router.get('/profile', auth, userController.getProfile);

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               preferredNotifications:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.put('/profile', auth, userController.updateProfile);

/**
 * @swagger
 * /api/users/change-password:
 *   post:
 *     summary: Change user password
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 */
router.post('/change-password', auth, userController.changePassword);

/**
 * @swagger
 * /api/users/avatar:
 *   post:
 *     summary: Upload user avatar
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar uploaded successfully
 */
router.post('/avatar', auth, uploadAvatar, userController.uploadAvatar);

/**
 * @swagger
 * /api/users/addresses:
 *   get:
 *     summary: Get user addresses
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Addresses retrieved successfully
 */
router.get('/addresses', auth, async (req, res) => {
  try {
    const { prisma } = require('../config/database');
    const addresses = await prisma.userAddress.findMany({
      where: { user_id: req.user.id },
      orderBy: [{ is_primary: 'desc' }, { created_at: 'desc' }],
    });

    res.json({
      success: true,
      data: { addresses },
    });
  } catch (error) {
    console.error('Get addresses error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * @swagger
 * /api/users/addresses:
 *   post:
 *     summary: Add new address
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - street
 *               - houseNumber
 *             properties:
 *               title:
 *                 type: string
 *               street:
 *                 type: string
 *               houseNumber:
 *                 type: string
 *               apartmentNumber:
 *                 type: string
 *               floor:
 *                 type: integer
 *               entrance:
 *                 type: string
 *               doorcode:
 *                 type: string
 *               comment:
 *                 type: string
 *               isPrimary:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Address added successfully
 */
router.post('/addresses', auth, userController.addAddress);

/**
 * @swagger
 * /api/users/addresses/{id}:
 *   put:
 *     summary: Update address
 *     tags: [Users]
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
 *             $ref: '#/components/schemas/UserAddress'
 *     responses:
 *       200:
 *         description: Address updated successfully
 */
router.put('/addresses/:id', auth, userController.updateAddress);

/**
 * @swagger
 * /api/users/addresses/{id}:
 *   delete:
 *     summary: Delete address
 *     tags: [Users]
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
 *         description: Address deleted successfully
 */
router.delete('/addresses/:id', auth, userController.deleteAddress);

module.exports = router;