const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    // Проверяем, не в черном списке ли токен
    const blacklistedToken = await prisma.authToken.findFirst({
      where: {
        token: token,
        type: 'blacklist',
        expires_at: { gt: new Date() },
      },
    });

    if (blacklistedToken) {
      return res.status(401).json({
        success: false,
        message: 'Token revoked.',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Проверяем, что токен содержит userId
    if (!decoded.userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token structure.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        profile: true,
        addresses: {
          where: { is_primary: true },
          take: 1,
        },
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found.',
      });
    }

    // Проверяем, верифицирован ли email (если требуется)
    if (process.env.REQUIRE_EMAIL_VERIFICATION === 'true' && !user.email_verified) {
      return res.status(403).json({
        success: false,
        message: 'Email not verified. Please verify your email address.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.',
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Authentication failed.',
    });
  }
};

const adminAuth = async (req, res, next) => {
  try {
    // Используем auth middleware сначала
    await auth(req, res, () => {
      if (req.user.role !== 'admin' && req.user.role !== 'manager') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin rights required.',
        });
      }
      next();
    });
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    res.status(403).json({
      success: false,
      message: 'Access denied.',
    });
  }
};

// Middleware для проверки конкретных ролей
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${roles.join(', ')}`,
      });
    }

    next();
  };
};

// Middleware для проверки владения ресурсом
const isOwnerOrAdmin = (resourceOwnerIdPath = 'user.id') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    // Админы и менеджеры имеют доступ ко всем ресурсам
    if (req.user.role === 'admin' || req.user.role === 'manager') {
      return next();
    }

    // Получаем ID владельца ресурса из пути
    const resourceOwnerId = get(req, resourceOwnerIdPath);
    
    if (!resourceOwnerId) {
      return res.status(400).json({
        success: false,
        message: 'Resource owner ID not found.',
      });
    }

    // Проверяем, что пользователь является владельцем ресурса
    if (req.user.id !== parseInt(resourceOwnerId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access your own resources.',
      });
    }

    next();
  };
};

module.exports = { 
  auth, 
  adminAuth, 
  requireRole, 
  isOwnerOrAdmin 
};