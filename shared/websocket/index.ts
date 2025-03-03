import { Server as SocketIOServer, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

/**
 * Standard event types for WebSocket communication
 */
export enum EventType {
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
  EVENT = 'event',
  CAMERA_STATUS = 'camera_status',
  RECORDING_STATUS = 'recording_status',
  SYSTEM_NOTIFICATION = 'system_notification',
  ERROR = 'error',
  HEARTBEAT = 'heartbeat',
  HEARTBEAT_ACK = 'heartbeat_ack'
}

/**
 * Standard channel types for subscriptions
 */
export enum ChannelType {
  CAMERA_EVENTS = 'camera_events',
  SYSTEM_EVENTS = 'system_events',
  RECORDING_EVENTS = 'recording_events',
  DETECTION_EVENTS = 'detection_events',
  ALL_EVENTS = 'all_events'
}

/**
 * Interface for WebSocket event data
 */
export interface WebSocketEvent {
  type: string;
  timestamp: string;
  data: any;
}

/**
 * Interface for subscription data
 */
export interface SubscriptionData {
  channel: string;
  cameraId?: string;
  recordingId?: string;
}

/**
 * Options for WebSocket manager
 */
export interface WebSocketManagerOptions {
  /**
   * JWT secret for authentication
   */
  jwtSecret?: string;
  
  /**
   * CORS options
   */
  cors?: {
    origin: string | string[];
    methods?: string[];
  };
  
  /**
   * Authentication handler
   */
  authHandler?: (socket: Socket, next: (err?: Error) => void) => void;
  
  /**
   * Logger instance
   */
  logger?: any;
}

/**
 * WebSocket manager for handling standardized Socket.IO communications
 */
export class WebSocketManager {
  private io: SocketIOServer;
  private logger: any;
  private connectedClients: Map<string, Socket> = new Map();
  
  /**
   * Create a new WebSocket manager
   */
  constructor(
    server: any,
    options: WebSocketManagerOptions = {}
  ) {
    // Create Socket.IO server
    this.io = new SocketIOServer(server, {
      cors: options.cors || {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });
    
    // Store logger or create noop logger
    this.logger = options.logger || {
      info: () => {},
      error: () => {},
      debug: () => {}
    };
    
    // Set up authentication if provided
    if (options.authHandler) {
      this.io.use(options.authHandler);
    }
    
    // Set up default connection handler
    this.setupConnectionHandler();
  }
  
  /**
   * Set up connection handler for WebSocket
   */
  private setupConnectionHandler(): void {
    this.io.on('connection', (socket: Socket) => {
      const clientId = socket.id;
      this.connectedClients.set(clientId, socket);
      
      // Log connection
      this.logger.info(`Client connected: ${clientId}`);
      
      // Handle subscription
      socket.on(EventType.SUBSCRIBE, (data: SubscriptionData) => {
        this.handleSubscribe(socket, data);
      });
      
      // Handle unsubscription
      socket.on(EventType.UNSUBSCRIBE, (data: SubscriptionData) => {
        this.handleUnsubscribe(socket, data);
      });
      
      // Handle heartbeat
      socket.on(EventType.HEARTBEAT, () => {
        this.handleHeartbeat(socket);
      });
      
      // Handle disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }
  
  /**
   * Handle subscribe event
   */
  private handleSubscribe(socket: Socket, data: SubscriptionData): void {
    this.logger.info(`Client ${socket.id} subscribed to: ${JSON.stringify(data)}`);
    
    if (!data.channel) {
      this.sendError(socket, 'Channel is required for subscription');
      return;
    }
    
    let room = data.channel;
    
    // Handle different channel types
    switch (data.channel) {
      case ChannelType.CAMERA_EVENTS:
        if (!data.cameraId) {
          this.sendError(socket, 'Camera ID is required for camera_events subscription');
          return;
        }
        room = `camera:${data.cameraId}`;
        break;
        
      case ChannelType.RECORDING_EVENTS:
        if (!data.recordingId) {
          this.sendError(socket, 'Recording ID is required for recording_events subscription');
          return;
        }
        room = `recording:${data.recordingId}`;
        break;
    }
    
    // Join the room
    socket.join(room);
    
    // Acknowledge subscription
    socket.emit(EventType.EVENT, {
      type: 'subscription_success',
      timestamp: new Date().toISOString(),
      data: { channel: data.channel, room }
    });
  }
  
  /**
   * Handle unsubscribe event
   */
  private handleUnsubscribe(socket: Socket, data: SubscriptionData): void {
    this.logger.info(`Client ${socket.id} unsubscribed from: ${JSON.stringify(data)}`);
    
    if (!data.channel) {
      this.sendError(socket, 'Channel is required for unsubscription');
      return;
    }
    
    let room = data.channel;
    
    // Handle different channel types
    switch (data.channel) {
      case ChannelType.CAMERA_EVENTS:
        if (!data.cameraId) {
          this.sendError(socket, 'Camera ID is required for camera_events unsubscription');
          return;
        }
        room = `camera:${data.cameraId}`;
        break;
        
      case ChannelType.RECORDING_EVENTS:
        if (!data.recordingId) {
          this.sendError(socket, 'Recording ID is required for recording_events unsubscription');
          return;
        }
        room = `recording:${data.recordingId}`;
        break;
    }
    
    // Leave the room
    socket.leave(room);
    
    // Acknowledge unsubscription
    socket.emit(EventType.EVENT, {
      type: 'unsubscription_success',
      timestamp: new Date().toISOString(),
      data: { channel: data.channel, room }
    });
  }
  
  /**
   * Handle heartbeat event
   */
  private handleHeartbeat(socket: Socket): void {
    socket.emit(EventType.HEARTBEAT_ACK, {
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Handle disconnect event
   */
  private handleDisconnect(socket: Socket): void {
    this.logger.info(`Client disconnected: ${socket.id}`);
    this.connectedClients.delete(socket.id);
  }
  
  /**
   * Send an error to a client
   */
  private sendError(socket: Socket, message: string): void {
    socket.emit(EventType.ERROR, {
      type: EventType.ERROR,
      timestamp: new Date().toISOString(),
      data: { message }
    });
  }
  
  /**
   * Broadcast an event to all clients in a room
   */
  public broadcastToRoom(room: string, eventType: string, data: any): void {
    const event: WebSocketEvent = {
      type: eventType,
      timestamp: new Date().toISOString(),
      data
    };
    
    this.io.to(room).emit(EventType.EVENT, event);
    this.logger.debug(`Broadcast to room ${room}: ${JSON.stringify(event)}`);
  }
  
  /**
   * Broadcast camera event to subscribers
   */
  public broadcastCameraEvent(cameraId: string, eventType: string, data: any): void {
    this.broadcastToRoom(`camera:${cameraId}`, eventType, data);
  }
  
  /**
   * Broadcast recording event to subscribers
   */
  public broadcastRecordingEvent(recordingId: string, eventType: string, data: any): void {
    this.broadcastToRoom(`recording:${recordingId}`, eventType, data);
  }
  
  /**
   * Broadcast system event to all clients
   */
  public broadcastSystemEvent(eventType: string, data: any): void {
    const event: WebSocketEvent = {
      type: eventType,
      timestamp: new Date().toISOString(),
      data
    };
    
    this.io.emit(EventType.SYSTEM_NOTIFICATION, event);
    this.logger.debug(`System broadcast: ${JSON.stringify(event)}`);
  }
  
  /**
   * Get the number of connected clients
   */
  public getClientCount(): number {
    return this.connectedClients.size;
  }
  
  /**
   * Get the Socket.IO server instance
   */
  public getServer(): SocketIOServer {
    return this.io;
  }
  
  /**
   * Close the WebSocket server
   */
  public close(): Promise<void> {
    return new Promise((resolve) => {
      this.io.close(() => {
        this.logger.info('WebSocket server closed');
        resolve();
      });
    });
  }
}

/**
 * Create a WebSocket manager instance
 */
export function createWebSocketManager(
  server: any,
  options: WebSocketManagerOptions = {}
): WebSocketManager {
  return new WebSocketManager(server, options);
}