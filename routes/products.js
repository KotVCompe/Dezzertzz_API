const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { auth, adminAuth } = require('../middleware/auth');

/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         fullDescription:
 *           type: string
 *         price:
 *           type: number
 *           format: float
 *         categoryId:
 *           type: integer
 *         status:
 *           type: string
 *         weightGrams:
 *           type: integer
 *         volumeMl:
 *           type: integer
 *         calories:
 *           type: integer
 *         ingredients:
 *           type: array
 *           items:
 *             type: string
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *         sortOrder:
 *           type: integer
 *         purchaseCount:
 *           type: integer
 *     Category:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         imageUrl:
 *           type: string
 */

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get products with filtering and pagination
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: integer
 *         description: Filter by category ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           default: active
 *         description: Filter by status
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price filter
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price filter
 *       - in: query
 *         name: tags
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Filter by tags
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in name and description
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
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: sort_order
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           default: asc
 *         description: Sort order (asc/desc)
 *     responses:
 *       200:
 *         description: Products retrieved successfully
 */
router.get('/', productController.getProducts);

/**
 * @swagger
 * /api/products/categories:
 *   get:
 *     summary: Get all categories
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 */
router.get('/categories', productController.getCategories);

/**
 * @swagger
 * /api/products/search:
 *   get:
 *     summary: Search products
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: category
 *         schema:
 *           type: integer
 *         description: Filter by category
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of results
 *     responses:
 *       200:
 *         description: Search completed successfully
 */
router.get('/search', productController.searchProducts);

/**
 * @swagger
 * /api/products/popular:
 *   get:
 *     summary: Get popular products
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of popular products to return
 *     responses:
 *       200:
 *         description: Popular products retrieved successfully
 */
router.get('/popular', productController.getPopularProducts);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get product by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Product retrieved successfully
 *       404:
 *         description: Product not found
 */
router.get('/:id', productController.getProduct);

// Admin routes
/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Create new product (Admin only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Product'
 *     responses:
 *       201:
 *         description: Product created successfully
 */
router.post('/', adminAuth, async (req, res) => {
  try {
    const { prisma } = require('../config/database');
    const {
      name,
      description,
      fullDescription,
      price,
      categoryId,
      status,
      weightGrams,
      volumeMl,
      calories,
      ingredients,
      tags,
      sortOrder
    } = req.body;

    const product = await prisma.product.create({
      data: {
        name,
        description,
        full_description: fullDescription,
        price,
        category_id: categoryId, // ИСПРАВЛЕНО
        status: status || 'active',
        weight_grams: weightGrams,
        volume_ml: volumeMl,
        calories,
        ingredients: ingredients || [],
        tags: tags || [],
        sort_order: sortOrder || 0,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product },
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Update product (Admin only)
 *     tags: [Products]
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
 *             $ref: '#/components/schemas/Product'
 *     responses:
 *       200:
 *         description: Product updated successfully
 */
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { prisma } = require('../config/database');
    const product = await prisma.product.update({
      where: { id: parseInt(req.params.id) },
      data: req.body,
    });

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: { product },
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

module.exports = router;