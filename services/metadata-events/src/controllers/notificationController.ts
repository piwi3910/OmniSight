import { Request, Response } from 'express';
import { 
  getRecentNotifications, 
  markNotificationAsRead, 
  sendSystemNotification,
  sendEventNotification,
  sendCameraStatusNotification
} from '../utils/notificationManager';
import logger from '../utils/logger';

/**
 * Get all recent notifications
 * 
 * @route GET /api/notifications
 */
export const getNotifications = (req: Request, res: Response): void => {
  try {
    const notifications = getRecentNotifications();
    
    res.status(200).json({
      count: notifications.length,
      notifications
    });
  } catch (error) {
    logger.error('Error getting notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Mark a notification as read
 * 
 * @route PUT /api/notifications/:id/read
 */
export const markAsRead = (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    
    const success = markNotificationAsRead(id);
    
    if (!success) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }
    
    res.status(200).json({ message: 'Notification marked as read' });
  } catch (error) {
    logger.error(`Error marking notification ${req.params.id} as read:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Send a system notification
 * 
 * @route POST /api/notifications/system
 */
export const createSystemNotification = (req: Request, res: Response): void => {
  try {
    const { title, message, level, metadata } = req.body;
    
    // Validate request
    if (!title || !message) {
      res.status(400).json({ error: 'Title and message are required' });
      return;
    }
    
    // Send notification
    sendSystemNotification(title, message, level, metadata);
    
    res.status(201).json({ message: 'System notification sent' });
  } catch (error) {
    logger.error('Error creating system notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Send an event notification
 * 
 * @route POST /api/notifications/event
 */
export const createEventNotification = (req: Request, res: Response): void => {
  try {
    const { cameraId, cameraName, eventType, eventId, thumbnailPath } = req.body;
    
    // Validate request
    if (!cameraId || !cameraName || !eventType || !eventId) {
      res.status(400).json({ error: 'CameraId, cameraName, eventType, and eventId are required' });
      return;
    }
    
    // Send notification
    sendEventNotification(cameraId, cameraName, eventType, eventId, thumbnailPath);
    
    res.status(201).json({ message: 'Event notification sent' });
  } catch (error) {
    logger.error('Error creating event notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Send a camera status notification
 * 
 * @route POST /api/notifications/camera
 */
export const createCameraStatusNotification = (req: Request, res: Response): void => {
  try {
    const { cameraId, cameraName, status, message } = req.body;
    
    // Validate request
    if (!cameraId || !cameraName || !status) {
      res.status(400).json({ error: 'CameraId, cameraName, and status are required' });
      return;
    }
    
    // Validate status
    if (!['online', 'offline', 'error'].includes(status)) {
      res.status(400).json({ error: 'Status must be one of: online, offline, error' });
      return;
    }
    
    // Send notification
    sendCameraStatusNotification(cameraId, cameraName, status, message);
    
    res.status(201).json({ message: 'Camera status notification sent' });
  } catch (error) {
    logger.error('Error creating camera status notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};