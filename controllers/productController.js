const { prisma } = require('../config/database');

const productController = {
  // Получение всех товаров с фильтрацией
  getProducts: async (req, res) => {
  try {
    const {
      category,
      status = 'active',
      minPrice,
      maxPrice,
      tags,
      search,
      page = 1,
      limit = 20,
      sortBy = 'sort_order',
      sortOrder = 'asc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Валидация полей для сортировки
    const allowedSortFields = ['name', 'price', 'created_at', 'sort_order', 'purchase_count'];
    const allowedSortOrders = ['asc', 'desc'];
    
    const validatedSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'sort_order';
    const validatedSortOrder = allowedSortOrders.includes(sortOrder.toLowerCase()) ? sortOrder : 'asc';

    // Строим фильтр
    const where = {
      status: status,
    };

      if (category) {
  const categoryId = parseInt(category);
  if (!isNaN(categoryId)) {
    where.category_id = categoryId;
  }
}

      if (minPrice || maxPrice) {
        where.price = {};
        if (minPrice) where.price.gte = parseFloat(minPrice);
        if (maxPrice) where.price.lte = parseFloat(maxPrice);
      }

      if (tags) {
        const tagArray = Array.isArray(tags) ? tags : [tags];
        where.tags = { hasSome: tagArray };
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { tags: { has: search } },
        ];
      }

      // Получаем товары
      const products = await prisma.product.findMany({
        where,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              image_url: true,
            },
          },
          images: {
            orderBy: { sort_order: 'asc' },
            take: 1, // Только первое изображение для списка
          },
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip,
        take: parseInt(limit),
      });

      // Получаем общее количество для пагинации
      const total = await prisma.product.count({ where });

      res.json({
        success: true,
        data: {
          products,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit)),
          },
        },
      });
    } catch (error) {
      console.error('Get products error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },

  // Получение одного товара
  getProduct: async (req, res) => {
    try {
      const { id } = req.params;

      const product = await prisma.product.findUnique({
        where: { id: parseInt(id) },
        include: {
          category: true,
          images: {
            orderBy: { sort_order: 'asc' },
          },
        },
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found',
        });
      }

      res.json({
        success: true,
        data: { product },
      });
    } catch (error) {
      console.error('Get product error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },

  // Получение категорий
  getCategories: async (req, res) => {
    try {
      const categories = await prisma.category.findMany({
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: {
              products: {
                where: { status: 'active' },
              },
            },
          },
        },
      });

      res.json({
        success: true,
        data: { categories },
      });
    } catch (error) {
      console.error('Get categories error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },

  // Поиск товаров
  searchProducts: async (req, res) => {
    try {
      const { q, category, limit = 10 } = req.query;

      if (!q) {
        return res.status(400).json({
          success: false,
          message: 'Search query is required',
        });
      }

      const where = {
        status: 'active',
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { tags: { has: q } },
        ],
      };

      if (category) {
        where.category_id = parseInt(category);
      }

      const products = await prisma.product.findMany({
        where,
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          images: {
            orderBy: { sort_order: 'asc' },
            take: 1,
          },
        },
        take: parseInt(limit),
      });

      res.json({
        success: true,
        data: { products },
      });
    } catch (error) {
      console.error('Search products error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },

  // Получение популярных товаров
  getPopularProducts: async (req, res) => {
    try {
      const { limit = 10 } = req.query;

      const products = await prisma.product.findMany({
        where: {
          status: 'active',
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          images: {
            orderBy: { sort_order: 'asc' },
            take: 1,
          },
        },
        orderBy: {
          purchase_count: 'desc',
        },
        take: parseInt(limit),
      });

      res.json({
        success: true,
        data: { products },
      });
    } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
},
};

module.exports = productController;