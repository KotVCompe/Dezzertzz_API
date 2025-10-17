const nodemailer = require('nodemailer');
const { prisma } = require('../config/database');

// Создаем транспорт для SendGrid
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD, 
    },
  });
};
const emailUtils = {
  // Отправка email для верификации
  sendVerificationEmail: async (email, token) => {
    try {
      const transporter = createTransporter();
      const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${token}`;

      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@dessertshop.com',
        to: email,
        subject: 'Verify Your Email - Dessert Shop',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #e91e63;">Welcome to Dessert Shop! 🍰</h2>
            <p>Please verify your email address to complete your registration.</p>
            <a href="${verificationUrl}" 
               style="display: inline-block; padding: 12px 24px; background-color: #e91e63; color: white; text-decoration: none; border-radius: 4px;">
               Verify Email
            </a>
            <p>Or copy this link:</p>
            <p>${verificationUrl}</p>
            <p>This link will expire in 24 hours.</p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`Verification email sent to ${email}`);
    } catch (error) {
      console.error('Error sending verification email:', error);
      throw error;
    }
  },

  // Отправка email для сброса пароля
  sendPasswordResetEmail: async (email, token) => {
    try {
      const transporter = createTransporter();
      const resetUrl = `${process.env.CLIENT_URL}/reset-password/${token}`;

      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@dessertshop.com',
        to: email,
        subject: 'Reset Your Password - Dessert Shop',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #e91e63;">Password Reset Request</h2>
            <p>You requested to reset your password. Click the button below:</p>
            <a href="${resetUrl}" 
               style="display: inline-block; padding: 12px 24px; background-color: #e91e63; color: white; text-decoration: none; border-radius: 4px;">
               Reset Password
            </a>
            <p>Or copy this link:</p>
            <p>${resetUrl}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`Password reset email sent to ${email}`);
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw error;
    }
  },

  // Подтверждение заказа
  sendOrderConfirmation: async (email, order) => {
    try {
      const transporter = createTransporter();

      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@dessertshop.com',
        to: email,
        subject: `Order Confirmation - ${order.order_number}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #e91e63;">Thank you for your order! 🎉</h2>
            <p>Your order <strong>${order.order_number}</strong> has been received and is being processed.</p>
            
            <h3>Order Summary:</h3>
            <div style="background: #f9f9f9; padding: 15px; border-radius: 4px;">
              ${order.items.map(item => `
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span>${item.product.name} x ${item.quantity}</span>
                  <span>${(item.unit_price * item.quantity).toFixed(2)} ₽</span>
                </div>
              `).join('')}
              <hr style="margin: 10px 0;">
              <div style="display: flex; justify-content: space-between; font-weight: bold;">
                <span>Total:</span>
                <span>${order.total_amount.toFixed(2)} ₽</span>
              </div>
            </div>

            <h3>Delivery Address:</h3>
            <p>
              ${order.delivery_address_street}, ${order.delivery_address_house}
              ${order.delivery_address_apartment ? `, Apt. ${order.delivery_address_apartment}` : ''}
            </p>

            <p>We'll notify you when your order is on its way!</p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`Order confirmation sent to ${email}`);
    } catch (error) {
      console.error('Error sending order confirmation:', error);
      throw error;
    }
  },

  // Уведомление о статусе заказа
  sendOrderStatusUpdate: async (email, order, newStatus) => {
    try {
      const transporter = createTransporter();

      const statusMessages = {
        'confirmed': 'has been confirmed and is being prepared',
        'preparing': 'is being prepared in our kitchen',
        'ready_for_delivery': 'is ready for delivery',
        'out_for_delivery': 'is out for delivery',
        'delivered': 'has been delivered',
        'cancelled': 'has been cancelled',
      };

      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@dessertshop.com',
        to: email,
        subject: `Order Update - ${order.order_number}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #e91e63;">Order Status Update</h2>
            <p>Your order <strong>${order.order_number}</strong> ${statusMessages[newStatus]}.</p>
            
            <p>Current status: <strong>${newStatus}</strong></p>
            
            <p>Thank you for choosing Dessert Shop!</p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`Order status update sent to ${email}`);
    } catch (error) {
      console.error('Error sending order status update:', error);
      throw error;
    }
  },
};

module.exports = emailUtils;

