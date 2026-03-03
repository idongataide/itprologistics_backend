// services/notificationService.js

const Notification = require('../models/Notification');

// Create a notification
const createNotification = async (userId, type, title, message, relatedData = {}) => {
  try {
    const notification = new Notification({
      userId,
      type,
      title,
      message,
      orderId: relatedData.orderId || null,
      driverId: relatedData.driverId || null,
      vehicleId: relatedData.vehicleId || null,
      data: relatedData
    });

    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Create notifications for multiple users
const createBulkNotifications = async (userIds, type, title, message, relatedData = {}) => {
  try {
    const notifications = userIds.map(userId => ({
      userId,
      type,
      title,
      message,
      orderId: relatedData.orderId || null,
      driverId: relatedData.driverId || null,
      vehicleId: relatedData.vehicleId || null,
      data: relatedData
    }));

    await Notification.insertMany(notifications);
    return notifications;
  } catch (error) {
    console.error('Error creating bulk notifications:', error);
    throw error;
  }
};

// Notify all admins
const notifyAdmins = async (type, title, message, relatedData = {}) => {
  try {
    const User = require('../models/User');
    const admins = await User.find({ role: 'admin' }, '_id');
    const adminIds = admins.map(admin => admin._id);

    if (adminIds.length > 0) {
      await createBulkNotifications(adminIds, type, title, message, relatedData);
    }
  } catch (error) {
    console.error('Error notifying admins:', error);
  }
};

// Mark notification as read
const markAsRead = async (notificationId) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      {
        isRead: true,
        readAt: new Date()
      },
      { new: true }
    );
    return notification;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

// Mark multiple notifications as read
const markMultipleAsRead = async (notificationIds) => {
  try {
    await Notification.updateMany(
      { _id: { $in: notificationIds } },
      {
        isRead: true,
        readAt: new Date()
      }
    );
  } catch (error) {
    console.error('Error marking multiple notifications as read:', error);
    throw error;
  }
};

// Get user notifications
const getUserNotifications = async (userId, limit = 50, skip = 0) => {
  try {
    const notifications = await Notification.find({ userId })
      .populate('orderId', '_id pickupLocation destination status')
      .populate('driverId', '_id licenseNumber')
      .populate('vehicleId', '_id make model')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Notification.countDocuments({ userId });
    const unread = await Notification.countDocuments({ userId, isRead: false });

    return {
      notifications,
      total,
      unread
    };
  } catch (error) {
    console.error('Error fetching user notifications:', error);
    throw error;
  }
};

// Delete old notifications (older than 30 days)
const deleteOldNotifications = async (daysOld = 30) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await Notification.deleteMany({
      createdAt: { $lt: cutoffDate }
    });

    return result;
  } catch (error) {
    console.error('Error deleting old notifications:', error);
    throw error;
  }
};

module.exports = {
  createNotification,
  createBulkNotifications,
  notifyAdmins,
  markAsRead,
  markMultipleAsRead,
  getUserNotifications,
  deleteOldNotifications
};
