import * as amqp from 'amqplib';
import config from '../config/config';
import logger from './logger';

// RabbitMQ connection
let connection: amqp.Connection | null = null;
let channel: amqp.Channel | null = null;

/**
 * Initialize RabbitMQ connection and channel
 */
export const initRabbitMQ = async (): Promise<void> => {
  try {
    // Create connection URL
    const { host, port, username, password } = config.rabbitmq;
    const connectionUrl = `amqp://${username}:${password}@${host}:${port}`;
    
    // Connect to RabbitMQ
    connection = await amqp.connect(connectionUrl);
    logger.info('Connected to RabbitMQ');
    
    // Create channel
    if (connection) {
      channel = await connection.createChannel();
      logger.info('Created RabbitMQ channel');
      
      // Set up exchanges
      if (channel) {
        await channel.assertExchange(config.rabbitmq.frameExchange, 'topic', { durable: true });
        await channel.assertExchange(config.rabbitmq.eventExchange, 'topic', { durable: true });
        logger.info('RabbitMQ exchanges set up');
      }
      
      // Handle connection close
      connection.on('close', () => {
        logger.error('RabbitMQ connection closed');
        // Attempt to reconnect after delay
        setTimeout(initRabbitMQ, 5000);
      });
      
      // Handle errors
      connection.on('error', (err) => {
        logger.error('RabbitMQ connection error:', err);
        // Connection will close and trigger the 'close' event
      });
    }
  } catch (error) {
    logger.error('Failed to connect to RabbitMQ:', error);
    // Attempt to reconnect after delay
    setTimeout(initRabbitMQ, 5000);
  }
};

/**
 * Publish a message to a RabbitMQ exchange with a routing key
 */
export const publishMessage = async (
  exchange: string,
  routingKey: string,
  message: Buffer | object
): Promise<boolean> => {
  try {
    if (!channel) {
      logger.error('Cannot publish message: RabbitMQ channel not initialized');
      return false;
    }
    
    // Convert object to buffer if needed
    const content = Buffer.isBuffer(message)
      ? message
      : Buffer.from(JSON.stringify(message));
    
    // Publish message
    const result = channel.publish(exchange, routingKey, content);
    
    if (!result) {
      logger.warn(`Message to ${exchange}/${routingKey} was not published`);
    }
    
    return result;
  } catch (error) {
    logger.error(`Error publishing message to ${exchange}/${routingKey}:`, error);
    return false;
  }
};

/**
 * Publish a video frame to RabbitMQ
 */
export const publishVideoFrame = async (
  cameraId: string,
  streamId: string,
  frame: Buffer,
  timestamp: Date
): Promise<boolean> => {
  const routingKey = `camera.${cameraId}.stream.${streamId}`;
  
  // Add frame metadata as properties
  const properties = {
    timestamp: timestamp.toISOString(),
    cameraId,
    streamId
  };
  
  return publishMessage(config.rabbitmq.frameExchange, routingKey, frame);
};

/**
 * Publish a stream event to RabbitMQ
 */
export const publishStreamEvent = async (
  cameraId: string,
  streamId: string,
  eventType: 'started' | 'stopped' | 'error',
  data: any
): Promise<boolean> => {
  const routingKey = `camera.${cameraId}.event.${eventType}`;
  
  const message = {
    cameraId,
    streamId,
    eventType,
    timestamp: new Date().toISOString(),
    data
  };
  
  return publishMessage(config.rabbitmq.eventExchange, routingKey, message);
};

/**
 * Close RabbitMQ connection
 */
export const closeRabbitMQ = async (): Promise<void> => {
  try {
    if (channel) {
      await channel.close();
      logger.info('Closed RabbitMQ channel');
    }
    
    if (connection) {
      await connection.close();
      logger.info('Closed RabbitMQ connection');
    }
  } catch (error) {
    logger.error('Error closing RabbitMQ connection:', error);
  } finally {
    channel = null;
    connection = null;
  }
};