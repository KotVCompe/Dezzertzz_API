const { z } = require('zod');

const updateProfileValidation = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters').optional(),
  phoneNumber: z.string().optional(),
  dateOfBirth: z.string().optional(),
  preferredNotifications: z.boolean().optional(),
});

const changePasswordValidation = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

const addressValidation = z.object({
  title: z.string().min(1, 'Title is required'),
  street: z.string().min(1, 'Street is required'),
  houseNumber: z.string().min(1, 'House number is required'),
  apartmentNumber: z.string().optional(),
  floor: z.number().int().optional(),
  entrance: z.string().optional(),
  doorcode: z.string().optional(),
  comment: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

module.exports = {
  updateProfileValidation,
  changePasswordValidation,
  addressValidation,
};