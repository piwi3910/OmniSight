import { notificationRepository } from '../repositories/notificationRepository';
import { eventService } from './eventService';
import { Socket } from 'socket.io';
import logger from '../utils/logger';

// Store the socket.io instance
let io: any = null;

/**
 * Service class for notification business logic
 */
export class NotificationService {
  /**
   * Initialize the notification service with Socket.IO instance
   */
  initialize(socketIo: any) {
    io = socketIo;
    logger.info('Notification service initialized with Socket.IO');
  }
  
  /**
   * Create and send a notification
   */
  async createNotification(data: {
    userId?: string;
    eventId?: string;
    title: string;
    message: string;
    type: string;
    metadata?: Record<string, any>;
  }): Promise<any> {
    try {
      // Create notification in database
      const notification = await notificationRepository.createNotification({
        ...data,
        read: false
      });
      
      // If we have Socket.IO instance and a specific user, send to that user
      if (io && data.userId) {
        io.to(`user:${data.userId}`).emit('notification', notification);
      } 
      
      // If it's related to a camera, send to camera subscribers
      if (io && data.metadata?.cameraId) {
        io.to(`camera:${data.metadata.cameraId}`).emit('notification', notification);
      }
      
      // For system-wide notifications
      if (io && data.type.startsWith('system_')) {
        io.emit('system_notification', notification);
      }
      
      logger.info(`Notification sent: ${data.title}`);
      return notification;
    } catch (error) {
      logger.error('Error in createNotification service:', error);
      throw error;
    }
  }
  
  /**
   * Create and send a notification for an event
   */
  async createEventNotification(eventId: string): Promise<any> {
    try {
      // Get event details
      const event = await eventService.getEventById(eventId);
      
      if (!event) {
        throw new Error(`Event with ID ${eventId} not found`);
      }
      
      // Create notification for the event
      const title = `${event.eventType} Detected`;
      const message = `${event.eventType} detected from ${event.recording?.camera?.name || 'a camera'}`;
      
      return await this.createNotification({
        eventId,
        title,
        message,
        type: event.eventType,
        metadata: {
          cameraId: event.recording?.camera?.id,
          confidence: event.confidence,
          timestamp: event.timestamp
        }
      });
    } catch (error) {
      logger.error(`Error creating notification for event ${eventId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get notifications for a user
   */
  async getNotificationsByUser(userId: string, options?: {
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    try {
      return await notificationRepository.getNotificationsByUser(userId, options);
    } catch (error) {
      logger.error(`Error getting notifications for user ${userId}:`, error);
      throw error;
    }
  }
  
  /**
   * Mark a notification as read
   */
  async markNotificationAsRead(notificationId: string): Promise<any> {
    try {
      return await notificationRepository.markNotificationAsRead(notificationId);
    } catch (error) {
      logger.error(`Error marking notification ${notificationId} as read:`, error);
      throw error;
    }
  }
  
  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      return await notificationRepository.deleteNotification(notificationId);
    } catch (error) {
      logger.error(`Error deleting notification ${notificationId}:`, error);
      throw error;
    }
  }
  
  /**
   * Broadcast a system notification to all connected clients
   */
  broadcastSystemNotification(title: string, message: string, metadata?: Record<string, any>): void {
    if (!io) {
      logger.warn('Cannot broadcast system notification: Socket.IO not initialized');
      return;
    }
    
    const notification = {
      id: `system-${Date.now()}`,
      title,
      message,
      type: 'system_notification',
      metadata: metadata || {},
      timestamp: new Date()
    };
    
    io.emit('system_notification', notification);
    logger.info(`System notification broadcast: ${title}`);
  }
  
  /**
   * Broadcast a camera-specific notification to subscribers
   */
  broadcastCameraNotification(cameraId: string, title: string, message: string, metadata?: Record<string, any>): void {
    if (!io) {
      logger.warn('Cannot broadcast camera notification: Socket.IO not initialized');
      return;
    }
    
    const notification = {
      id: `camera-${Date.now()}`,
      title,
      message,
      type: 'camera_notification',
      metadata: {
        ...metadata,
        cameraId
      },
      timestamp: new Date()
    };
    
    io.to(`camera:${cameraId}`).emit('camera_notification', notification);
    logger.info(`Camera notification broadcast for camera ${cameraId}: ${title}`);
  }
}

// Export a singleton instance
export const notificationService = new NotificationService();

// Backward compatibility with the previous manager
export const initNotificationManager = (socketIo: any) => {
  notificationService.initialize(socketIo);
};