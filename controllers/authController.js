const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');
const {
  registerValidation,
  loginValidation,
  resetPasswordValidation,
  changePasswordValidation,
} = require('../validations/authValidation');
const emailUtils = require('../utils/email');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const authController = {
  // Регистрация
  register: async (req, res) => {
    try {
      const validatedData = registerValidation.parse(req.body);
      
      const { email, password, firstName, phoneNumber } = validatedData;

      // Проверяем, существует ли пользователь
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists',
        });
      }

      // Хешируем пароль
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Создаем пользователя
      const user = await prisma.user.create({
        data: {
          email,
          password_hash: passwordHash,
          first_name: firstName,
          phone_number: phoneNumber,
          email_verification_token: jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1d' }),
        },
      });

      // Создаем профиль
      await prisma.userProfile.create({
        data: {
          user_id: user.id,
        },
      });

      // Отправляем email для верификации
      await emailUtils.sendVerificationEmail(user.email, user.email_verification_token);

      // Генерируем токен
      const token = generateToken(user.id);

      res.status(201).json({
        success: true,
        message: 'User registered successfully. Please check your email for verification.',
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            phoneNumber: user.phone_number,
            emailVerified: user.email_verified,
            role: user.role,
          },
          token,
        },
      });
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }

      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },

  // Вход
  login: async (req, res) => {
    try {
      const validatedData = loginValidation.parse(req.body);
      const { email, password } = validatedData;

      // Находим пользователя
      const user = await prisma.user.findUnique({
        where: { email },
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
          message: 'Invalid email or password',
        });
      }

      // Проверяем пароль
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      // Генерируем токен
      const token = generateToken(user.id);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            phoneNumber: user.phone_number,
            avatarUrl: user.avatar_url,
            emailVerified: user.email_verified,
            role: user.role,
            profile: user.profile,
            primaryAddress: user.addresses[0] || null,
          },
          token,
        },
      });
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }

      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },

  // Восстановление пароля
  forgotPassword: async (req, res) => {
    try {
      const validatedData = resetPasswordValidation.parse(req.body);
      const { email } = validatedData;

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        // Для безопасности не сообщаем, что пользователь не найден
        return res.json({
          success: true,
          message: 'If the email exists, a password reset link has been sent.',
        });
      }

      // Генерируем токен для сброса пароля
      const resetToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 час

      await prisma.user.update({
        where: { id: user.id },
        data: {
          reset_password_token: resetToken,
          reset_password_expires: resetExpires,
        },
      });

      // Отправляем email
      await emailUtils.sendPasswordResetEmail(user.email, resetToken);

      res.json({
        success: true,
        message: 'If the email exists, a password reset link has been sent.',
      });
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }

      console.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },

  // Сброс пароля
  resetPassword: async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Token and new password are required',
        });
      }

      // Валидируем токен
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const user = await prisma.user.findFirst({
        where: {
          id: decoded.userId,
          reset_password_token: token,
          reset_password_expires: { gt: new Date() },
        },
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token',
        });
      }

      // Хешируем новый пароль
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);

      // Обновляем пароль и очищаем токен сброса
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password_hash: passwordHash,
          reset_password_token: null,
          reset_password_expires: null,
        },
      });

      res.json({
        success: true,
        message: 'Password reset successfully',
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }
  },

  // Верификация email
  verifyEmail: async (req, res) => {
    try {
      const { token } = req.params;

      const user = await prisma.user.findFirst({
        where: {
          email_verification_token: token,
        },
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification token',
        });
      }

      // Обновляем статус верификации
      await prisma.user.update({
        where: { id: user.id },
        data: {
          email_verified: true,
          email_verification_token: null,
        },
      });

      res.json({
        success: true,
        message: 'Email verified successfully',
      });
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(400).json({
        success: false,
        message: 'Invalid verification token',
      });
    }
  },

  // Выход
  logout: async (req, res) => {
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      
      if (token) {
        // Добавляем токен в черный список
        await prisma.authToken.create({
          data: {
            user_id: req.user.id,
            token: token,
            type: 'blacklist',
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 дней
          },
        });
      }

      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },
};

module.exports = authController;