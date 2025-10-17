const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');
const { updateProfileValidation, changePasswordValidation } = require('../validations/userValidation');

// Валидация файлов аватара
const validateAvatarFile = (file) => {
  if (!file) {
    throw new Error('No file uploaded');
  }

  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.');
  }

  if (file.size > maxSize) {
    throw new Error('File size too large. Maximum size is 5MB.');
  }

  return true;
};

const userController = {
  // Получение профиля пользователя
  getProfile: async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          profile: true,
          addresses: {
            orderBy: { is_primary: 'desc' }
          },
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      res.json({
        success: true,
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
            addresses: user.addresses,
          },
        },
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },

  // Обновление профиля
  updateProfile: async (req, res) => {
    try {
      const validatedData = updateProfileValidation.parse(req.body);
      
      const { firstName, phoneNumber, dateOfBirth, preferredNotifications } = validatedData;

      // Валидация даты рождения
      const isValidDate = dateOfBirth ? !isNaN(new Date(dateOfBirth).getTime()) : true;
      if (!isValidDate) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date of birth',
        });
      }

      // Используем транзакцию для атомарности
      const result = await prisma.$transaction(async (prisma) => {
        // Обновляем основную информацию пользователя
        const updatedUser = await prisma.user.update({
          where: { id: req.user.id },
          data: {
            first_name: firstName,
            phone_number: phoneNumber,
            updated_at: new Date(),
          },
          include: {
            profile: true,
          },
        });

        // Обновляем профиль
        await prisma.userProfile.upsert({
          where: { user_id: req.user.id },
          update: {
            date_of_birth: dateOfBirth && isValidDate ? new Date(dateOfBirth) : null,
            preferred_notifications: preferredNotifications,
            updated_at: new Date(),
          },
          create: {
            user_id: req.user.id,
            date_of_birth: dateOfBirth && isValidDate ? new Date(dateOfBirth) : null,
            preferred_notifications: preferredNotifications !== undefined ? preferredNotifications : true,
          },
        });

        return updatedUser;
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: {
            id: result.id,
            email: result.email,
            firstName: result.first_name,
            phoneNumber: result.phone_number,
            avatarUrl: result.avatar_url,
          },
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

      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },

  // Смена пароля
  changePassword: async (req, res) => {
    try {
      const validatedData = changePasswordValidation.parse(req.body);
      const { currentPassword, newPassword } = validatedData;

      // Проверяем, что новый пароль отличается от текущего
      if (currentPassword === newPassword) {
        return res.status(400).json({
          success: false,
          message: 'New password must be different from current password',
        });
      }

      // Получаем пользователя с хешем пароля
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Проверяем текущий пароль
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect',
        });
      }

      // Хешируем новый пароль
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Обновляем пароль
      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          password_hash: newPasswordHash,
          updated_at: new Date(),
        },
      });

      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }

      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },

  // Добавление адреса
  addAddress: async (req, res) => {
    try {
      const {
        title = 'Дом',
        street,
        houseNumber,
        apartmentNumber,
        floor,
        entrance,
        doorcode,
        comment,
        isPrimary = false,
      } = req.body;

      if (!street || !houseNumber) {
        return res.status(400).json({
          success: false,
          message: 'Street and house number are required',
        });
      }

      // Валидация номера этажа
      if (floor && (isNaN(parseInt(floor)) || parseInt(floor) < 0)) {
        return res.status(400).json({
          success: false,
          message: 'Floor must be a positive number',
        });
      }

      // Используем транзакцию
      const address = await prisma.$transaction(async (prisma) => {
        // Если это основной адрес, снимаем флаг с других адресов
        if (isPrimary) {
          await prisma.userAddress.updateMany({
            where: { user_id: req.user.id, is_primary: true },
            data: { is_primary: false },
          });
        }

        return await prisma.userAddress.create({
          data: {
            user_id: req.user.id,
            title,
            street,
            house_number: houseNumber,
            apartment_number: apartmentNumber,
            floor: floor ? parseInt(floor) : null,
            entrance,
            doorcode,
            comment,
            is_primary: isPrimary,
          },
        });
      });

      res.status(201).json({
        success: true,
        message: 'Address added successfully',
        data: { address },
      });
    } catch (error) {
      console.error('Add address error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },

  // Обновление адреса
  updateAddress: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        title,
        street,
        houseNumber,
        apartmentNumber,
        floor,
        entrance,
        doorcode,
        comment,
        isPrimary,
      } = req.body;

      // Валидация ID
      const addressId = parseInt(id);
      if (isNaN(addressId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid address ID',
        });
      }

      // Валидация номера этажа
      if (floor && (isNaN(parseInt(floor)) || parseInt(floor) < 0)) {
        return res.status(400).json({
          success: false,
          message: 'Floor must be a positive number',
        });
      }

      // Используем транзакцию
      const updatedAddress = await prisma.$transaction(async (prisma) => {
        // Проверяем, что адрес принадлежит пользователю
        const existingAddress = await prisma.userAddress.findFirst({
          where: { id: addressId, user_id: req.user.id },
        });

        if (!existingAddress) {
          throw new Error('Address not found');
        }

        // Если делаем адрес основным, снимаем флаг с других адресов
        if (isPrimary) {
          await prisma.userAddress.updateMany({
            where: { user_id: req.user.id, is_primary: true },
            data: { is_primary: false },
          });
        }

        return await prisma.userAddress.update({
          where: { id: addressId },
          data: {
            title,
            street,
            house_number: houseNumber,
            apartment_number: apartmentNumber,
            floor: floor ? parseInt(floor) : null,
            entrance,
            doorcode,
            comment,
            is_primary: isPrimary,
          },
        });
      });

      res.json({
        success: true,
        message: 'Address updated successfully',
        data: { address: updatedAddress },
      });
    } catch (error) {
      if (error.message === 'Address not found') {
        return res.status(404).json({
          success: false,
          message: 'Address not found',
        });
      }

      console.error('Update address error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },

  // Удаление адреса
  deleteAddress: async (req, res) => {
    try {
      const { id } = req.params;

      // Валидация ID
      const addressId = parseInt(id);
      if (isNaN(addressId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid address ID',
        });
      }

      // Проверяем, что адрес принадлежит пользователю
      const address = await prisma.userAddress.findFirst({
        where: { id: addressId, user_id: req.user.id },
      });

      if (!address) {
        return res.status(404).json({
          success: false,
          message: 'Address not found',
        });
      }

      await prisma.userAddress.delete({
        where: { id: addressId },
      });

      res.json({
        success: true,
        message: 'Address deleted successfully',
      });
    } catch (error) {
      console.error('Delete address error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },

  // Загрузка аватара
  uploadAvatar: async (req, res) => {
    try {
      // Валидация файла
      validateAvatarFile(req.file);

      // Здесь будет логика загрузки в AWS S3
      // Пока используем локальный путь
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;

      // Обновляем пользователя
      const updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: {
          avatar_url: avatarUrl,
          updated_at: new Date(),
        },
      });

      res.json({
        success: true,
        message: 'Avatar uploaded successfully',
        data: {
          avatarUrl: updatedUser.avatar_url,
        },
      });
    } catch (error) {
      console.error('Upload avatar error:', error);
      
      if (error.message.includes('No file uploaded') || 
          error.message.includes('Invalid file type') || 
          error.message.includes('File size too large')) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },
};

module.exports = userController;