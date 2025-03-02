import { Server as SocketIOServer } from 'socket.io';
import axios from 'axios';
import logger from './logger';

// Socket.io server instance
let io: SocketIOServer | null = null;

// Interface for notification
interface Notification {
  id: string;
  type: 'event' | 'system' | 'camera';
  level: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  metadata?: any;
  read?: boolean;
}

// Store for recent notifications (in-memory cache)
const recentNotifications: Notification[] = [];
const MAX_NOTIFICATIONS = 100;

/**
 * Initialize notification manager with Socket.IO server
 */
export const initNotificationManager = (socketServer: SocketIOServer): void => {
  io = socketServer;
  
  logger.info('Notification manager initialized');
};

/**
 * Send a notification to all connected clients
 */
export const sendNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): void => {
  try {
    // Create notification object
    const fullNotification: Notification = {
      id: generateId(),
      timestamp: new Date(),
      read: false,
      ...notification
    };
    
    // Add to recent notifications
    addToRecentNotifications(fullNotification);
    
    // Send to all connected clients
    if (io) {
      io.emit('notification', fullNotification);
      logger.debug(`Sent notification: ${fullNotification.title}`);
    } else {
      logger.warn('Socket.IO server not initialized, notification not sent');
    }
    
    // If it's an error or warning, also log it
    if (notification.level === 'error' || notification.level === 'warning') {
      logger.warn(`Notification [${notification.level}]: ${notification.title} - ${notification.message}`);
    }
  } catch (error) {
    logger.error('Error sending notification:', error);
  }
};

/**
 * Send a notification to specific room (e.g., for a specific camera)
 */
export const sendNotificationToRoom = (room: string, notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): void => {
  try {
    // Create notification object
    const fullNotification: Notification = {
      id: generateId(),
      timestamp: new Date(),
      read: false,
      ...notification
    };
    
    // Add to recent notifications
    addToRecentNotifications(fullNotification);
    
    // Send to specific room
    if (io) {
      io.to(room).emit('notification', fullNotification);
      logger.debug(`Sent notification to room ${room}: ${fullNotification.title}`);
    } else {
      logger.warn('Socket.IO server not initialized, notification not sent');
    }
  } catch (error) {
    logger.error(`Error sending notification to room ${room}:`, error);
  }
};

/**
 * Send an event notification
 */
export const sendEventNotification = (
  cameraId: string,
  cameraName: string,
  eventType: string,
  eventId: string,
  thumbnailPath?: string
): void => {
  // Create notification
  const notification: Omit<Notification, 'id' | 'timestamp' | 'read'> = {
    type: 'event',
    level: 'info',
    title: `New ${eventType} detected`,
    message: `Camera "${cameraName}" detected a ${eventType} event`,
    metadata: {
      cameraId,
      eventId,
      eventType,
      thumbnailPath
    }
  };
  
  // Send to all clients
  sendNotification(notification);
  
  // Send to camera-specific room
  sendNotificationToRoom(`camera:${cameraId}`, notification);
};

/**
 * Send a camera status notification
 */
export const sendCameraStatusNotification = (
  cameraId: string,
  cameraName: string,
  status: 'online' | 'offline' | 'error',
  message?: string
): void => {
  // Determine notification level
  const level = status === 'online' ? 'info' : status === 'offline' ? 'warning' : 'error';
  
  // Create notification
  const notification: Omit<Notification, 'id' | 'timestamp' | 'read'> = {
    type: 'camera',
    level,
    title: `Camera ${status}`,
    message: message || `Camera "${cameraName}" is now ${status}`,
    metadata: {
      cameraId,
      status
    }
  };
  
  // Send to all clients
  sendNotification(notification);
  
  // Send to camera-specific room
  sendNotificationToRoom(`camera:${cameraId}`, notification);
};

/**
 * Send a system notification
 */
export const sendSystemNotification = (
  title: string,
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  metadata?: any
): void => {
  // Create notification
  const notification: Omit<Notification, 'id' | 'timestamp' | 'read'> = {
    type: 'system',
    level,
    title,
    message,
    metadata
  };
  
  // Send to all clients
  sendNotification(notification);
};

/**
 * Get recent notifications
 */
export const getRecentNotifications = (): Notification[] => {
  return [...recentNotifications];
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = (notificationId: string): boolean => {
  const notification = recentNotifications.find(n => n.id === notificationId);
  
  if (notification) {
    notification.read = true;
    return true;
  }
  
  return false;
};

/**
 * Add notification to recent notifications
 */
const addToRecentNotifications = (notification: Notification): void => {
  // Add to beginning of array
  recentNotifications.unshift(notification);
  
  // Trim array if it exceeds max size
  if (recentNotifications.length > MAX_NOTIFICATIONS) {
    recentNotifications.pop();
  }
};

/**
 * Generate a unique ID for notifications
 */
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
};