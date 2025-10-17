const { z } = require('zod');

const registerValidation = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  phoneNumber: z.string().optional(),
});

const loginValidation = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const resetPasswordValidation = z.object({
  email: z.string().email('Invalid email format'),
});

const changePasswordValidation = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

const updateProfileValidation = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters').optional(),
  phoneNumber: z.string().optional(),
  dateOfBirth: z.string().optional(),
  preferredNotifications: z.boolean().optional(),
});

module.exports = {
  registerValidation,
  loginValidation,
  resetPasswordValidation,
  changePasswordValidation,
  updateProfileValidation,
};