const { z } = require('zod');

const testNotificationValidation = z.object({
  type: z.enum(['email', 'telegram'], {
    required_error: 'Type is required',
    invalid_type_error: 'Type must be either email or telegram',
  }),
  message: z.string().min(1, 'Message is required'),
});

const bulkNotificationValidation = z.object({
  type: z.enum(['email', 'telegram']),
  message: z.string().min(1, 'Message is required'),
  target: z.string().optional(),
});

const telegramSubscriptionValidation = z.object({
  chatId: z.number().int().positive('Chat ID must be a positive integer'),
  firstName: z.string().optional(),
  username: z.string().optional(),
});

const notificationSettingsValidation = z.object({
  emailNotifications: z.boolean().optional(),
  phone: z.string().optional(),
});

module.exports = {
  testNotificationValidation,
  bulkNotificationValidation,
  telegramSubscriptionValidation,
  notificationSettingsValidation,
};