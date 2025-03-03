/**
 * Shared messaging module for standardized RabbitMQ communication
 */
import amqp, { Channel, Connection, Message } from 'amqplib';
import { v4 as uuidv4 } from 'uuid';

/**
 * Available message types in the system
 */
export enum MessageType {
  // Stream related events
  STREAM_STARTED = 'stream.started',
  STREAM_STOPPED = 'stream.stopped',
  STREAM_ERROR = 'stream.error',
  STREAM_FRAME = 'stream.frame', // Video frame from stream
  
  // Recording events
  RECORDING_STARTED = 'recording.started',
  RECORDING_STOPPED = 'recording.stopped',
  RECORDING_SEGMENT_CREATED = 'recording.segment.created',
  RECORDING_ERROR = 'recording.error',
  
  // Detection events
  DETECTION_STARTED = 'detection.started',
  DETECTION_COMPLETED = 'detection.completed',
  OBJECT_DETECTED = 'object.detected',
  DETECTION_ERROR = 'detection.error',
  
  // System events
  SYSTEM_ALERT = 'system.alert',
  HEALTH_CHECK = 'system.health',
  CONFIG_UPDATED = 'system.config.updated'
}

/**
 * Message priority levels
 */
export enum MessagePriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 8,
  CRITICAL = 10
}

/**
 * Standard message interface
 */
export interface StandardMessage<T = any> {
  /** Unique message ID */
  messageId: string;
  
  /** Message type */
  type: MessageType;
  
  /** Service that sent the message */
  source: string;
  
  /** Timestamp when message was created */
  timestamp: string;
  
  /** Main message payload */
  payload: T;
  
  /** Message priority */
  priority?: MessagePriority;
  
  /** Message expiration in milliseconds */
  expiration?: number;
  
  /** Correlation ID for request-response pattern */
  correlationId?: string;
  
  /** Reply-to queue for request-response pattern */
  replyTo?: string;
  
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Stream frame message payload
 */
export interface StreamFramePayload {
  streamId: string;
  cameraId: string;
  timestamp: string;
  frameNumber: number;
  width: number;
  height: number;
  format: string; // e.g., 'jpeg', 'raw', etc.
  data: string; // Base64 encoded frame data
}

/**
 * Recording segment payload
 */
export interface RecordingSegmentPayload {
  recordingId: string;
  segmentId: string;
  cameraId: string;
  streamId: string;
  startTime: string;
  endTime: string;
  duration: number;
  filePath: string;
  fileSize: number;
  format: string;
  thumbnailPath?: string;
}

/**
 * Object detection payload
 */
export interface ObjectDetectionPayload {
  detectionId: string;
  cameraId: string;
  streamId?: string;
  recordingId?: string;
  timestamp: string;
  objects: Array<{
    objectType: string;
    confidence: number;
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
  frameWidth: number;
  frameHeight: number;
  thumbnailPath?: string;
}

/**
 * RabbitMQ connection manager
 */
export class RabbitMQManager {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private serviceName: string;
  private url: string;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 1000;
  private isConnecting: boolean = false;
  private logger: any;
  
  /**
   * Create a new RabbitMQ manager
   */
  constructor(options: {
    url: string;
    serviceName: string;
    logger?: any;
    maxReconnectAttempts?: number;
    reconnectDelay?: number;
  }) {
    this.url = options.url;
    this.serviceName = options.serviceName;
    this.logger = options.logger || console;
    
    if (options.maxReconnectAttempts) {
      this.maxReconnectAttempts = options.maxReconnectAttempts;
    }
    
    if (options.reconnectDelay) {
      this.reconnectDelay = options.reconnectDelay;
    }
  }
  
  /**
   * Connect to RabbitMQ
   */
  public async connect(): Promise<void> {
    if (this.connection || this.isConnecting) {
      return;
    }
    
    this.isConnecting = true;
    
    try {
      this.logger.info(`Connecting to RabbitMQ at ${this.url}`);
      this.connection = await amqp.connect(this.url);
      
      // Handle connection close
      this.connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed');
        this.handleDisconnect();
      });
      
      // Handle connection errors
      this.connection.on('error', (err) => {
        this.logger.error('RabbitMQ connection error', err);
        this.handleDisconnect();
      });
      
      // Create channel
      this.channel = await this.connection.createChannel();
      
      // Reset reconnect attempts on successful connection
      this.reconnectAttempts = 0;
      this.isConnecting = false;
      
      this.logger.info('Connected to RabbitMQ');
    } catch (error) {
      this.logger.error('Failed to connect to RabbitMQ', error);
      this.isConnecting = false;
      this.handleDisconnect();
    }
  }
  
  /**
   * Handle disconnection and reconnect
   */
  private handleDisconnect(): void {
    this.channel = null;
    this.connection = null;
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      this.logger.info(`Reconnecting to RabbitMQ in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => this.connect(), delay);
    } else {
      this.logger.error(`Failed to reconnect to RabbitMQ after ${this.maxReconnectAttempts} attempts`);
    }
  }
  
  /**
   * Close the connection
   */
  public async close(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
    }
    
    if (this.connection) {
      await this.connection.close();
    }
    
    this.channel = null;
    this.connection = null;
  }
  
  /**
   * Set up exchanges and queues
   */
  public async setupTopology(): Promise<void> {
    if (!this.channel) {
      await this.connect();
    }
    
    if (!this.channel) {
      throw new Error('Failed to set up RabbitMQ topology: No channel available');
    }
    
    // Main exchanges
    await this.channel.assertExchange('events', 'topic', { durable: true });
    await this.channel.assertExchange('streams', 'topic', { durable: true });
    await this.channel.assertExchange('recordings', 'topic', { durable: true });
    await this.channel.assertExchange('detection', 'topic', { durable: true });
    await this.channel.assertExchange('system', 'topic', { durable: true });
    
    // Dead letter exchange
    await this.channel.assertExchange('dead-letter', 'fanout', { durable: true });
    
    this.logger.info('RabbitMQ topology set up');
  }
  
  /**
   * Publish a message to an exchange
   */
  public async publish<T>(
    exchange: string,
    routingKey: string,
    message: StandardMessage<T>,
    options: {
      persistent?: boolean;
      expiration?: number;
      priority?: MessagePriority;
    } = {}
  ): Promise<boolean> {
    if (!this.channel) {
      await this.connect();
    }
    
    if (!this.channel) {
      throw new Error('Failed to publish message: No channel available');
    }
    
    // Set message defaults
    const finalMessage: StandardMessage<T> = {
      messageId: message.messageId || uuidv4(),
      timestamp: message.timestamp || new Date().toISOString(),
      source: message.source || this.serviceName,
      ...message,
    };
    
    // Publish options
    const publishOptions = {
      persistent: options.persistent !== undefined ? options.persistent : true,
      expiration: options.expiration?.toString() || message.expiration?.toString(),
      messageId: finalMessage.messageId,
      timestamp: finalMessage.timestamp,
      type: finalMessage.type,
      priority: options.priority || message.priority || MessagePriority.NORMAL,
      correlationId: finalMessage.correlationId,
      replyTo: finalMessage.replyTo,
      headers: finalMessage.metadata || {},
    };
    
    // Publish the message
    return this.channel.publish(
      exchange,
      routingKey,
      Buffer.from(JSON.stringify(finalMessage)),
      publishOptions
    );
  }
  
  /**
   * Create a standardized message
   */
  public createMessage<T>(
    type: MessageType,
    payload: T,
    options: {
      priority?: MessagePriority;
      correlationId?: string;
      replyTo?: string;
      metadata?: Record<string, any>;
      expiration?: number;
    } = {}
  ): StandardMessage<T> {
    return {
      messageId: uuidv4(),
      type,
      source: this.serviceName,
      timestamp: new Date().toISOString(),
      payload,
      priority: options.priority,
      correlationId: options.correlationId,
      replyTo: options.replyTo,
      metadata: options.metadata,
      expiration: options.expiration,
    };
  }
  
  /**
   * Create a consumer for a queue
   */
  public async consume<T = any>(
    queue: string,
    handler: (message: StandardMessage<T>, originalMessage: Message) => Promise<void> | void,
    options: {
      prefetch?: number;
      noAck?: boolean;
    } = {}
  ): Promise<string> {
    if (!this.channel) {
      await this.connect();
    }
    
    if (!this.channel) {
      throw new Error('Failed to create consumer: No channel available');
    }
    
    // Set prefetch
    if (options.prefetch) {
      await this.channel.prefetch(options.prefetch);
    }
    
    // Consume messages
    return this.channel.consume(
      queue,
      async (msg) => {
        if (!msg) {
          return;
        }
        
        try {
          const content = msg.content.toString();
          const parsedMessage = JSON.parse(content) as StandardMessage<T>;
          
          await handler(parsedMessage, msg);
          
          if (!options.noAck) {
            this.channel?.ack(msg);
          }
        } catch (error) {
          this.logger.error('Error processing message', error);
          
          if (!options.noAck) {
            // Reject the message and requeue if it's the first attempt
            const requeue = !msg.fields.redelivered;
            this.channel?.reject(msg, requeue);
            
            if (!requeue) {
              try {
                // Send to dead-letter exchange if not requeuing
                this.channel?.publish(
                  'dead-letter',
                  '',
                  msg.content,
                  {
                    headers: {
                      'x-original-exchange': msg.fields.exchange,
                      'x-original-routing-key': msg.fields.routingKey,
                      'x-error': error.message
                    }
                  }
                );
              } catch (dlxError) {
                this.logger.error('Failed to send message to dead-letter exchange', dlxError);
              }
            }
          }
        }
      },
      { noAck: options.noAck }
    );
  }
  
  /**
   * Bind a queue to an exchange with a routing key
   */
  public async bindQueue(
    queue: string,
    exchange: string,
    routingKey: string
  ): Promise<void> {
    if (!this.channel) {
      await this.connect();
    }
    
    if (!this.channel) {
      throw new Error('Failed to bind queue: No channel available');
    }
    
    await this.channel.assertQueue(queue, { durable: true });
    await this.channel.bindQueue(queue, exchange, routingKey);
  }
}

/**
 * Create a RabbitMQ manager
 */
export function createRabbitMQManager(options: {
  url: string;
  serviceName: string;
  logger?: any;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
}): RabbitMQManager {
  return new RabbitMQManager(options);
}