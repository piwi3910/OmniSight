import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyToken } from './auth';
import axios from 'axios';
import config from '../config/config';
import logger from '../utils/logger';

/**
 * WebSocket proxy implementation for routing WebSocket connections to appropriate microservices
 */

let io: SocketIOServer;

/**
 * Initialize the WebSocket server
 * @param socketServer - Socket.IO server instance
 */
export const initializeWebSocketServer = (socketServer: SocketIOServer): void => {
  io = socketServer;
  
  // Set up connection handler
  io.on('connection', handleConnection);
  
  logger.info('WebSocket server initialized');
};

/**
 * Handle new WebSocket connections
 * @param socket - Socket.IO socket
 */
const handleConnection = async (socket: Socket): Promise<void> => {
  try {
    // Extract token from query parameters
    const token = socket.handshake.query.token as string;
    
    if (!token) {
      logger.warn('WebSocket connection attempt without token');
      socket.emit('error', { message: 'Authentication required' });
      socket.disconnect(true);
      return;
    }
    
    // Verify token
    try {
      const user = verifyToken(token);
      
      if (!user) {
        logger.warn('WebSocket connection attempt with invalid token');
        socket.emit('error', { message: 'Invalid token' });
        socket.disconnect(true);
        return;
      }
      
      // Attach user info to socket
      (socket as any).user = user;
      
      logger.info(`WebSocket connection established for user ${user.id}`);
      
      // Set up event listeners
      setupEventListeners(socket);
      
    } catch (error) {
      logger.error('Error verifying token:', error);
      socket.emit('error', { message: 'Authentication failed' });
      socket.disconnect(true);
    }
  } catch (error) {
    logger.error('Error handling WebSocket connection:', error);
    socket.emit('error', { message: 'Server error' });
    socket.disconnect(true);
  }
};

/**
 * Set up event listeners for the socket
 * @param socket - Socket.IO socket
 */
const setupEventListeners = (socket: Socket): void => {
  // Handle subscribe requests
  socket.on('subscribe', async (data) => {
    try {
      const { channel } = data;
      const user = (socket as any).user;
      
      if (!channel) {
        socket.emit('error', { message: 'Channel is required for subscription' });
        return;
      }
      
      logger.info(`User ${user.id} subscribing to channel ${channel}`);
      
      // Check if user has permission to subscribe to this channel
      const hasPermission = await checkChannelPermission(channel, user);
      
      if (!hasPermission) {
        logger.warn(`User ${user.id} denied access to channel ${channel}`);
        socket.emit('error', { message: 'Access denied to this channel' });
        return;
      }
      
      // Join the channel
      socket.join(channel);
      socket.emit('subscribed', { channel });
      
      logger.info(`User ${user.id} subscribed to channel ${channel}`);
    } catch (error) {
      logger.error('Error handling subscribe request:', error);
      socket.emit('error', { message: 'Failed to subscribe to channel' });
    }
  });
  
  // Handle unsubscribe requests
  socket.on('unsubscribe', (data) => {
    try {
      const { channel } = data;
      const user = (socket as any).user;
      
      if (!channel) {
        socket.emit('error', { message: 'Channel is required for unsubscription' });
        return;
      }
      
      // Leave the channel
      socket.leave(channel);
      socket.emit('unsubscribed', { channel });
      
      logger.info(`User ${user.id} unsubscribed from channel ${channel}`);
    } catch (error) {
      logger.error('Error handling unsubscribe request:', error);
      socket.emit('error', { message: 'Failed to unsubscribe from channel' });
    }
  });
  
  // Handle heartbeat
  socket.on('heartbeat', () => {
    socket.emit('heartbeat');
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    const user = (socket as any).user;
    if (user) {
      logger.info(`WebSocket disconnected for user ${user.id}`);
    } else {
      logger.info('WebSocket disconnected for unknown user');
    }
  });
};

/**
 * Check if a user has permission to access a channel
 * @param channel - Channel name
 * @param user - User object
 * @returns Promise resolving to boolean indicating permission
 */
const checkChannelPermission = async (channel: string, user: any): Promise<boolean> => {
  try {
    // Parse channel to determine appropriate service
    const [resourceType, resourceId] = channel.split(':');
    
    if (!resourceType || !resourceId) {
      logger.warn(`Invalid channel format: ${channel}`);
      return false;
    }
    
    // Map resource type to service
    const serviceUrlMap: Record<string, string> = {
      'camera': config.services.metadataEvents.url,
      'event': config.services.metadataEvents.url,
      'recording': config.services.recording.url,
      'stream': config.services.streamIngestion.url
    };
    
    const serviceUrl = serviceUrlMap[resourceType];
    
    if (!serviceUrl) {
      logger.warn(`Unknown resource type in channel: ${resourceType}`);
      return false;
    }
    
    // Check permission with appropriate service
    const response = await axios.get(`${serviceUrl}/api/permissions/check`, {
      params: {
        resourceType,
        resourceId,
        userId: user.id
      },
      headers: {
        'x-service-name': 'api-gateway'
      },
      timeout: 5000
    });
    
    return response.data.hasPermission === true;
  } catch (error) {
    logger.error('Error checking channel permission:', error);
    // Default to false for security
    return false;
  }
};

/**
 * Broadcast a message to a channel
 * @param channel - Channel to broadcast to
 * @param eventType - Event type
 * @param data - Event data
 */
export const broadcastToChannel = (channel: string, eventType: string, data: any): void => {
  if (!io) {
    logger.error('Attempted to broadcast before WebSocket server was initialized');
    return;
  }
  
  logger.debug(`Broadcasting ${eventType} to channel ${channel}`);
  io.to(channel).emit(eventType, {
    type: eventType,
    timestamp: new Date().toISOString(),
    data
  });
};

/**
 * Send a message to a specific user
 * @param userId - User ID to send to
 * @param eventType - Event type
 * @param data - Event data
 */
export const sendToUser = (userId: string, eventType: string, data: any): void => {
  if (!io) {
    logger.error('Attempted to send message before WebSocket server was initialized');
    return;
  }
  
  // Find all sockets for this user
  const sockets = Array.from(io.sockets.sockets.values())
    .filter(socket => (socket as any).user && (socket as any).user.id === userId);
  
  if (sockets.length === 0) {
    logger.warn(`No active connections found for user ${userId}`);
    return;
  }
  
  logger.debug(`Sending ${eventType} to user ${userId}`);
  
  // Send to all user's connections
  sockets.forEach(socket => {
    socket.emit(eventType, {
      type: eventType,
      timestamp: new Date().toISOString(),
      data
    });
  });
};

/**
 * Get WebSocket server instance
 * @returns Socket.IO server instance
 */
export const getSocketIOServer = (): SocketIOServer => {
  if (!io) {
    throw new Error('WebSocket server not initialized');
  }
  
  return io;
};