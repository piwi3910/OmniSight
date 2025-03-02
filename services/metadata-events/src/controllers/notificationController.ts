import { Request, Response } from 'express';
import { notificationService } from '../services/notificationService';
import logger from '../utils/logger';

/**
 * Get notifications for a user
 */
export const getUserNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const unreadOnly = req.query.unreadOnly === 'true';
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    
    const notifications = await notificationService.getNotificationsByUser(userId, {
      unreadOnly,
      limit,
      offset
    });
    
    return res.status(200).json({
      success: true,
      data: notifications
    });
  } catch (error) {
    logger.error('Error in getUserNotifications controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve notifications',
      error: (error as Error).message
    });
  }
};

/**
 * Mark a notification as read
 */
export const markNotificationAsRead = async (req: Request, res: Response) => {
  try {
    const notificationId = req.params.notificationId;
    
    const updatedNotification = await notificationService.markNotificationAsRead(notificationId);
    
    return res.status(200).json({
      success: true,
      data: updatedNotification
    });
  } catch (error) {
    logger.error('Error in markNotificationAsRead controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: (error as Error).message
    });
  }
};

/**
 * Delete a notification
 */
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const notificationId = req.params.notificationId;
    
    const result = await notificationService.deleteNotification(notificationId);
    
    if (result) {
      return res.status(200).json({
        success: true,
        message: 'Notification deleted successfully'
      });
    } else {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
  } catch (error) {
    logger.error('Error in deleteNotification controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: (error as Error).message
    });
  }
};

/**
 * Send a test notification
 */
export const sendTestNotification = async (req: Request, res: Response) => {
  try {
    const { userId, title, message, type } = req.body;
    
    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required'
      });
    }
    
    const notification = await notificationService.createNotification({
      userId,
      title,
      message,
      type: type || 'test_notification',
      metadata: {
        test: true,
        timestamp: new Date()
      }
    });
    
    return res.status(201).json({
      success: true,
      data: notification,
      message: 'Test notification sent successfully'
    });
  } catch (error) {
    logger.error('Error in sendTestNotification controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send test notification',
      error: (error as Error).message
    });
  }
};

/**
 * Create a notification for an event
 */
export const createEventNotification = async (req: Request, res: Response) => {
  try {
    const eventId = req.params.eventId;
    
    const notification = await notificationService.createEventNotification(eventId);
    
    return res.status(201).json({
      success: true,
      data: notification,
      message: 'Event notification created successfully'
    });
  } catch (error) {
    logger.error('Error in createEventNotification controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create event notification',
      error: (error as Error).message
    });
  }
};