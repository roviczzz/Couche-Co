const express = require('express');
const router = express.Router();
const {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  generatePeriodicNotifications
} = require('../admin-helpers');

// Middleware to determine user role from route
function getUserRole(req) {
  // First check the session user role
  if (req.session && req.session.user && req.session.user.role) {
    return req.session.user.role;
  }
  
  // Fallback to URL-based detection
  if (req.originalUrl.includes('/admin/')) return 'admin';
  if (req.originalUrl.includes('/staff/')) return 'staff';
  
  // Default fallback
  return 'admin';
}

// Get notifications for current user role
router.get('/api/notifications', async (req, res) => {
  try {
    const userRole = getUserRole(req);
    const limit = parseInt(req.query.limit) || 50;
    
    console.log('📢 Fetching notifications - Role:', userRole, 'Limit:', limit);
    
    const notifications = await getNotifications(userRole, limit);
    
    console.log('📢 Found', notifications.length, 'notifications for role:', userRole);
    
    res.json({
      success: true,
      notifications,
      count: notifications.length,
      userRole: userRole
    });
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
});

// Get unread notification count
router.get('/api/notifications/unread-count', async (req, res) => {
  try {
    const userRole = getUserRole(req);
    
    console.log('📊 Fetching unread count for role:', userRole);
    
    const count = await getUnreadNotificationCount(userRole);
    
    console.log('📊 Unread count:', count, 'for role:', userRole);
    
    res.json({
      success: true,
      unreadCount: count,
      userRole: userRole
    });
  } catch (error) {
    console.error('❌ Error fetching unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unread count',
      error: error.message
    });
  }
});

// Mark notification as read
router.post('/api/notifications/:id/read', async (req, res) => {
  try {
    const notificationId = req.params.id;
    await markNotificationAsRead(notificationId);
    
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
});

// Mark all notifications as read
router.post('/api/notifications/mark-all-read', async (req, res) => {
  try {
    const userRole = getUserRole(req);
    const result = await markAllNotificationsAsRead(userRole);
    
    res.json({
      success: true,
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read'
    });
  }
});

// Delete notification
router.delete('/api/notifications/:id', async (req, res) => {
  try {
    const notificationId = req.params.id;
    await deleteNotification(notificationId);
    
    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification'
    });
  }
});

// Generate periodic notifications (for testing/manual trigger)
router.post('/api/notifications/generate-periodic', async (req, res) => {
  try {
    const userSettings = req.body.settings || {};
    const notifications = await generatePeriodicNotifications(userSettings);
    
    res.json({
      success: true,
      message: 'Periodic notifications generated',
      generated: notifications.length
    });
  } catch (error) {
    console.error('Error generating periodic notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate periodic notifications'
    });
  }
});

module.exports = router;